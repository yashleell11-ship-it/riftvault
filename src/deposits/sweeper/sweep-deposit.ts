import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getUsdtTokenAddress, USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { deriveDepositAccount } from "@/deposits/blockchain/derive-account";
import { ERC20_TRANSFER_ABI, readUsdtBalance } from "@/deposits/blockchain/erc20";
import {
  estimateNativeTransferGas,
  estimateUsdtTransferGas,
  refundableBnbAmount,
} from "@/deposits/blockchain/gas";
import {
  createBscWalletClient,
  getTreasuryAccount,
} from "@/deposits/blockchain/wallet-client";
import {
  getMaxSweepRetries,
  getMinBnbRefundWei,
  getSweepTxConfirmations,
  SWEEP_STATUS,
} from "@/deposits/sweeper/config";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export type SweepResult = {
  depositId: string;
  status: string;
  skipped?: boolean;
  error?: string;
};

async function waitForConfirmations(txHash: `0x${string}`, required: number) {
  const client = getBscPublicClient();
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    confirmations: required,
    timeout: 120_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${txHash}`);
  }
  return receipt;
}

async function resolveDerivationIndex(
  depositId: string,
  toAddress: string | null
): Promise<number | null> {
  if (!toAddress) return null;

  const row = await prisma.userDepositAddress.findFirst({
    where: { address: toAddress.toLowerCase() },
    select: { derivationIndex: true },
  });
  if (row) return row.derivationIndex;

  const deposit = await prisma.cryptoDeposit.findUnique({
    where: { id: depositId },
    select: { userId: true, chainKey: true, asset: true },
  });
  if (!deposit) return null;

  const byUser = await prisma.userDepositAddress.findFirst({
    where: {
      userId: deposit.userId,
      chainKey: deposit.chainKey,
      asset: deposit.asset,
    },
    select: { derivationIndex: true },
  });
  return byUser?.derivationIndex ?? null;
}

async function markFailed(depositId: string, error: string) {
  await prisma.cryptoDeposit.update({
    where: { id: depositId },
    data: {
      sweepStatus: SWEEP_STATUS.FAILED,
      sweepError: error.slice(0, 2000),
      retryCount: { increment: 1 },
    },
  });
}

/** Claim a deposit row for sweeping (row-level lock via status transition). */
export async function claimDepositForSweep(depositId: string) {
  const maxRetries = getMaxSweepRetries();

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.cryptoDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) return null;
    if (deposit.status !== "confirmed" || !deposit.walletTxId) return null;
    if (deposit.sweepStatus === SWEEP_STATUS.COMPLETED) return null;

    const resumable = [
      SWEEP_STATUS.FUNDING_GAS,
      SWEEP_STATUS.SWEEPING,
      SWEEP_STATUS.SWEPT,
      SWEEP_STATUS.REFUNDING,
    ];

    const runnable =
      deposit.sweepStatus == null ||
      deposit.sweepStatus === SWEEP_STATUS.PENDING ||
      (deposit.sweepStatus === SWEEP_STATUS.FAILED && deposit.retryCount < maxRetries) ||
      resumable.includes(deposit.sweepStatus as (typeof resumable)[number]);

    if (!runnable) return null;

    const nextStatus =
      deposit.sweepStatus === SWEEP_STATUS.FAILED || deposit.sweepStatus == null
        ? SWEEP_STATUS.PENDING
        : deposit.sweepStatus;

    const claimed = await tx.cryptoDeposit.updateMany({
      where: {
        id: depositId,
        status: "confirmed",
        walletTxId: { not: null },
        sweepStatus: deposit.sweepStatus,
        NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
      },
      data: {
        sweepStatus: nextStatus,
        sweepError: null,
      },
    });

    if (claimed.count === 0) return null;
    return tx.cryptoDeposit.findUnique({ where: { id: depositId } });
  });
}

export async function sweepSingleDeposit(depositId: string): Promise<SweepResult> {
  const started = Date.now();
  const receiving = getReceivingWallet();
  const treasury = getTreasuryAccount();

  if (!receiving || !treasury) {
    return { depositId, status: "skipped", error: "Sweeper not configured" };
  }

  const deposit = await claimDepositForSweep(depositId);
  if (!deposit) {
    return { depositId, status: "skipped", skipped: true };
  }

  const depositAddress = deposit.toAddress?.toLowerCase() as `0x${string}` | undefined;
  const ctx: Parameters<typeof logSweepEvent>[1] = {
    depositId,
    depositAddress,
    amount: String(deposit.amount),
    step: "start",
  };

  try {
    if (!depositAddress) {
      throw new Error("Deposit has no toAddress");
    }

    const derivationIndex = await resolveDerivationIndex(depositId, depositAddress);
    if (derivationIndex == null) {
      throw new Error("No UserDepositAddress for deposit toAddress");
    }

    const depositAccount = deriveDepositAccount(derivationIndex);
    if (depositAccount.address.toLowerCase() !== depositAddress) {
      throw new Error("Derived address mismatch — check DEPOSIT_MNEMONIC");
    }

    const publicClient = getBscPublicClient();
    const depositWallet = createBscWalletClient(depositAccount);
    const treasuryWallet = createBscWalletClient(treasury);

    // ── Phase 1: Gas funding ──────────────────────────────────────────────
    let gasFundingTxHash = deposit.gasFundingTxHash as `0x${string}` | null;

    const usdtBalance = await readUsdtBalance(publicClient, depositAddress);

    if (usdtBalance > 0n) {
      const { gasCost } = await estimateUsdtTransferGas(
        publicClient,
        depositAddress,
        receiving,
        usdtBalance
      );
      const bnbBalance = await publicClient.getBalance({ address: depositAddress });

      if (bnbBalance < gasCost) {
        if (!gasFundingTxHash) {
          const gasClaim = await prisma.cryptoDeposit.updateMany({
            where: { id: depositId, gasFundingTxHash: null },
            data: { sweepStatus: SWEEP_STATUS.FUNDING_GAS },
          });
          if (gasClaim.count === 0) {
            const refreshed = await prisma.cryptoDeposit.findUnique({
              where: { id: depositId },
              select: { gasFundingTxHash: true },
            });
            gasFundingTxHash = refreshed?.gasFundingTxHash as `0x${string}` | null;
            if (!gasFundingTxHash) {
              throw new Error("Gas funding already in progress by another worker");
            }
          } else {
          const fundAmount = gasCost - bnbBalance;
          logSweepEvent("Funding gas for USDT sweep", {
            ...ctx,
            step: "fund_gas",
            gasSent: formatUnits(fundAmount, 18),
          });

          gasFundingTxHash = await treasuryWallet.sendTransaction({
            account: treasury.address,
            to: depositAddress,
            value: fundAmount,
            chain: treasuryWallet.chain,
          });

          await prisma.cryptoDeposit.update({
            where: { id: depositId },
            data: { gasFundingTxHash },
          });

          ctx.gasFundingTxHash = gasFundingTxHash;
          ctx.gasSent = formatUnits(fundAmount, 18);

          await waitForConfirmations(gasFundingTxHash, getSweepTxConfirmations());
          logSweepEvent("Gas funding confirmed", { ...ctx, step: "fund_gas_confirmed" });
          }
        } else {
          await waitForConfirmations(gasFundingTxHash, 1);
        }
      }
    }

    // ── Phase 2: USDT sweep ───────────────────────────────────────────────
    let sweepTxHash = deposit.sweepTxHash as `0x${string}` | null;
    const currentUsdt = await readUsdtBalance(publicClient, depositAddress);

    if (currentUsdt > 0n && !sweepTxHash) {
      const sweepClaim = await prisma.cryptoDeposit.updateMany({
        where: { id: depositId, sweepTxHash: null },
        data: { sweepStatus: SWEEP_STATUS.SWEEPING },
      });
      if (sweepClaim.count === 0) {
        const refreshed = await prisma.cryptoDeposit.findUnique({
          where: { id: depositId },
          select: { sweepTxHash: true },
        });
        sweepTxHash = refreshed?.sweepTxHash as `0x${string}` | null;
        if (!sweepTxHash) {
          throw new Error("USDT sweep already in progress by another worker");
        }
      } else {
      logSweepEvent("Sweeping USDT to treasury", {
        ...ctx,
        step: "sweep_usdt",
        amount: formatUnits(currentUsdt, USDT_DECIMALS),
      });

      sweepTxHash = await depositWallet.writeContract({
        address: getUsdtTokenAddress(),
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [receiving, currentUsdt],
        account: depositAccount.address,
        chain: depositWallet.chain,
      });

      await prisma.cryptoDeposit.update({
        where: { id: depositId },
        data: { sweepTxHash },
      });
      ctx.sweepTxHash = sweepTxHash;
      }
    }

    if (sweepTxHash) {
      await waitForConfirmations(sweepTxHash, getSweepTxConfirmations());

      await prisma.cryptoDeposit.update({
        where: { id: depositId },
        data: {
          sweepStatus: SWEEP_STATUS.SWEPT,
          sweptAt: deposit.sweptAt ?? new Date(),
        },
      });
      logSweepEvent("USDT sweep confirmed", { ...ctx, step: "sweep_confirmed" });
    } else if (currentUsdt === 0n) {
      logSweepEvent("No USDT balance — skipping transfer", { ...ctx, step: "no_usdt" });
    }

    // ── Phase 3: BNB refund ───────────────────────────────────────────────
    let gasRefundTxHash = deposit.gasRefundTxHash as `0x${string}` | null;

    if (!gasRefundTxHash) {
      const bnbAfter = await publicClient.getBalance({ address: depositAddress });
      const { gasCost } = await estimateNativeTransferGas(publicClient);
      const refundAmount = refundableBnbAmount(bnbAfter, gasCost, getMinBnbRefundWei());

      if (refundAmount > 0n) {
        const refundClaim = await prisma.cryptoDeposit.updateMany({
          where: { id: depositId, gasRefundTxHash: null },
          data: { sweepStatus: SWEEP_STATUS.REFUNDING },
        });
        if (refundClaim.count === 0) {
          const refreshed = await prisma.cryptoDeposit.findUnique({
            where: { id: depositId },
            select: { gasRefundTxHash: true },
          });
          gasRefundTxHash = refreshed?.gasRefundTxHash as `0x${string}` | null;
        } else {
        logSweepEvent("Refunding leftover BNB to treasury", {
          ...ctx,
          step: "refund_bnb",
          gasSent: formatUnits(refundAmount, 18),
        });

        gasRefundTxHash = await depositWallet.sendTransaction({
          account: depositAccount.address,
          to: receiving,
          value: refundAmount,
          chain: depositWallet.chain,
        });

        await prisma.cryptoDeposit.update({
          where: { id: depositId },
          data: { gasRefundTxHash },
        });
        ctx.gasRefundTxHash = gasRefundTxHash;

        await waitForConfirmations(gasRefundTxHash, getSweepTxConfirmations());
        logSweepEvent("BNB refund confirmed", { ...ctx, step: "refund_confirmed" });
        }
      } else {
        logSweepEvent("BNB refund skipped (dust or gas-only)", { ...ctx, step: "refund_skip" });
      }
    } else {
      await waitForConfirmations(gasRefundTxHash, 1);
    }

    await prisma.cryptoDeposit.update({
      where: { id: depositId },
      data: {
        sweepStatus: SWEEP_STATUS.COMPLETED,
        sweepError: null,
        sweptAt: deposit.sweptAt ?? new Date(),
      },
    });

    const durationMs = Date.now() - started;
    logSweepEvent("Sweep completed", { ...ctx, step: "completed", durationMs });

    return { depositId, status: SWEEP_STATUS.COMPLETED };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - started;
    logSweepEvent("Sweep failed", { ...ctx, step: "error", error: message, durationMs });
    await markFailed(depositId, message);
    return { depositId, status: SWEEP_STATUS.FAILED, error: message };
  }
}
