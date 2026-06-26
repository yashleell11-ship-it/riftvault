import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getUsdtTokenAddress, USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { deriveDepositAccount } from "@/deposits/blockchain/derive-account";
import { readUsdtBalance } from "@/deposits/blockchain/erc20";
import {
  estimateNativeTransferGas,
  estimateUsdtTransferGas,
  refundableBnbAmount,
} from "@/deposits/blockchain/gas";
import {
  getTreasuryAccount,
  getTreasuryAddressMismatch,
} from "@/deposits/blockchain/wallet-client";
import {
  sendSignedErc20Transfer,
  sendSignedTransaction,
} from "@/deposits/blockchain/send-signed";
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
  gasFundingTxHash?: string | null;
  sweepTxHash?: string | null;
  gasRefundTxHash?: string | null;
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
  const mismatch = getTreasuryAddressMismatch();
  const treasury = getTreasuryAccount();

  if (!receiving || !treasury) {
    const error = mismatch ?? "Sweeper not configured (treasury account unavailable)";
    logSweepEvent("Sweep skipped — config", { depositId, step: "config", error });
    return { depositId, status: "skipped", error };
  }

  const deposit = await claimDepositForSweep(depositId);
  if (!deposit) {
    logSweepEvent("Sweep skipped — claim failed", { depositId, step: "claim" });
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
      throw new Error(
        `Derived address ${depositAccount.address} does not match deposit toAddress ${depositAddress}`
      );
    }
    logSweepEvent("HD derivation verified", {
      ...ctx,
      step: "derive_verified",
      depositAddress: depositAccount.address,
    });

    const publicClient = getBscPublicClient();

    logSweepEvent("Local signing ready (sendRawTransaction only)", {
      ...ctx,
      step: "wallet_clients",
      depositAddress: depositAccount.address,
    });

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
            step: "gas_funding_started",
            gasSent: formatUnits(fundAmount, 18),
          });

          gasFundingTxHash = await sendSignedTransaction(treasury, {
            to: depositAddress,
            value: fundAmount,
          });

          await prisma.cryptoDeposit.update({
            where: { id: depositId },
            data: { gasFundingTxHash },
          });

          ctx.gasFundingTxHash = gasFundingTxHash;
          ctx.gasSent = formatUnits(fundAmount, 18);
          logSweepEvent("Gas funding tx submitted", {
            ...ctx,
            step: "gas_funding_tx_hash",
            gasFundingTxHash,
          });

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
      logSweepEvent("USDT sweep started", {
        ...ctx,
        step: "usdt_sweep_started",
        amount: formatUnits(currentUsdt, USDT_DECIMALS),
      });

      sweepTxHash = await sendSignedErc20Transfer(
        depositAccount,
        getUsdtTokenAddress(),
        receiving,
        currentUsdt
      );

      await prisma.cryptoDeposit.update({
        where: { id: depositId },
        data: { sweepTxHash },
      });
      ctx.sweepTxHash = sweepTxHash;
      logSweepEvent("USDT sweep tx submitted", {
        ...ctx,
        step: "usdt_sweep_tx_hash",
        sweepTxHash,
      });
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
        logSweepEvent("BNB refund started", {
          ...ctx,
          step: "bnb_refund_started",
          gasSent: formatUnits(refundAmount, 18),
        });

        gasRefundTxHash = await sendSignedTransaction(depositAccount, {
          to: receiving,
          value: refundAmount,
        });

        await prisma.cryptoDeposit.update({
          where: { id: depositId },
          data: { gasRefundTxHash },
        });
        ctx.gasRefundTxHash = gasRefundTxHash;
        logSweepEvent("BNB refund tx submitted", {
          ...ctx,
          step: "bnb_refund_tx_hash",
          gasRefundTxHash,
        });

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

    const final = await prisma.cryptoDeposit.findUnique({
      where: { id: depositId },
      select: { gasFundingTxHash: true, sweepTxHash: true, gasRefundTxHash: true },
    });

    return {
      depositId,
      status: SWEEP_STATUS.COMPLETED,
      gasFundingTxHash: final?.gasFundingTxHash,
      sweepTxHash: final?.sweepTxHash,
      gasRefundTxHash: final?.gasRefundTxHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const durationMs = Date.now() - started;
    logSweepEvent("Sweep failed", {
      ...ctx,
      step: "error",
      error: stack ? `${message}\n${stack}` : message,
      durationMs,
    });
    await markFailed(depositId, message);
    return { depositId, status: SWEEP_STATUS.FAILED, error: message };
  }
}
