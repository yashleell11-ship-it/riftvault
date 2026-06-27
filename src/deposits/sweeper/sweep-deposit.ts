import { formatUnits, parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getUsdtTokenAddress, USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { deriveDepositAccount } from "@/deposits/blockchain/derive-account";
import {
  canAffordNativeTransfer,
  estimateNativeTransferGas,
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
  ensureGasFunded,
  findPriorSweepTxAtAddress,
  readAddressBalances,
} from "@/deposits/sweeper/address-sweep";
import { isBlankSweepStatus } from "@/deposits/sweeper/backfill";
import { resolveDerivationIndexForDeposit } from "@/deposits/sweeper/derive-index";
import {
  getTxLiveness,
  isReceiptWaitTimeout,
  isTransactionConfirmed,
  waitForConfirmations as waitForTxConfirmations,
} from "@/deposits/sweeper/confirmations";
import {
  getMaxSweepRetries,
  getMinBnbRefundWei,
  getMinSweepUsdt,
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

async function resolveDerivationIndex(
  depositId: string,
  toAddress: string | null
): Promise<number | null> {
  return resolveDerivationIndexForDeposit(depositId, toAddress);
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

async function markSweepCompleted(
  depositId: string,
  sweptAt: Date | null,
  extra?: { sweepTxHash?: string | null; gasFundingTxHash?: string | null; gasRefundTxHash?: string | null }
) {
  await prisma.cryptoDeposit.update({
    where: { id: depositId },
    data: {
      sweepStatus: SWEEP_STATUS.COMPLETED,
      sweepError: null,
      sweptAt: sweptAt ?? new Date(),
      ...(extra?.sweepTxHash ? { sweepTxHash: extra.sweepTxHash } : {}),
      ...(extra?.gasFundingTxHash ? { gasFundingTxHash: extra.gasFundingTxHash } : {}),
      ...(extra?.gasRefundTxHash ? { gasRefundTxHash: extra.gasRefundTxHash } : {}),
    },
  });
}

function minSweepUsdtWei(): bigint {
  return parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);
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
      isBlankSweepStatus(deposit.sweepStatus) ||
      deposit.sweepStatus === SWEEP_STATUS.PENDING ||
      (deposit.sweepStatus === SWEEP_STATUS.FAILED && deposit.retryCount < maxRetries) ||
      resumable.includes(deposit.sweepStatus as (typeof resumable)[number]);

    if (!runnable) return null;

    const currentStatus = isBlankSweepStatus(deposit.sweepStatus)
      ? null
      : deposit.sweepStatus;
    const nextStatus =
      deposit.sweepStatus === SWEEP_STATUS.FAILED || isBlankSweepStatus(deposit.sweepStatus)
        ? SWEEP_STATUS.PENDING
        : deposit.sweepStatus;

    const statusWhere =
      currentStatus === null
        ? { OR: [{ sweepStatus: null }, { sweepStatus: "" }] }
        : { sweepStatus: currentStatus };

    const claimed = await tx.cryptoDeposit.updateMany({
      where: {
        id: depositId,
        status: "confirmed",
        walletTxId: { not: null },
        NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
        ...statusWhere,
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

    const minUsdt = minSweepUsdtWei();
    if (deposit.amount < getMinSweepUsdt()) {
      logSweepEvent("Deposit below minimum sweep amount — skipping", {
        ...ctx,
        step: "below_min_amount",
        amount: String(deposit.amount),
      });
      await markSweepCompleted(depositId, deposit.sweptAt, {
        sweepTxHash: deposit.sweepTxHash,
        gasFundingTxHash: deposit.gasFundingTxHash,
        gasRefundTxHash: deposit.gasRefundTxHash,
      });
      return {
        depositId,
        status: SWEEP_STATUS.COMPLETED,
        skipped: true,
        sweepTxHash: deposit.sweepTxHash,
        gasFundingTxHash: deposit.gasFundingTxHash,
        gasRefundTxHash: deposit.gasRefundTxHash,
      };
    }

    const publicClient = getBscPublicClient();
    const waitForConfirmations = (txHash: `0x${string}`, required: number) =>
      waitForTxConfirmations(publicClient, txHash, required);

    logSweepEvent("Local signing ready (sendRawTransaction only)", {
      ...ctx,
      step: "wallet_clients",
      depositAddress: depositAccount.address,
    });

    let balances = await readAddressBalances(publicClient, depositAddress);
    logSweepEvent("Address balance snapshot", {
      ...ctx,
      step: "balance_snapshot",
      amount: formatUnits(balances.usdt, USDT_DECIMALS),
      gasSent: formatUnits(balances.bnb, 18),
    });

    let gasFundingTxHash = deposit.gasFundingTxHash as `0x${string}` | null;
    let sweepTxHash = deposit.sweepTxHash as `0x${string}` | null;

    // ── Already swept: no USDT left at address ───────────────────────────
    if (balances.usdt === 0n) {
      if (!sweepTxHash) {
        sweepTxHash = await findPriorSweepTxAtAddress(depositAddress, depositId);
      }

      if (sweepTxHash) {
        if (!(await isTransactionConfirmed(publicClient, sweepTxHash, getSweepTxConfirmations()))) {
          await waitForConfirmations(sweepTxHash, getSweepTxConfirmations());
        }

        ctx.sweepTxHash = sweepTxHash;
        logSweepEvent("Address has no USDT — sweep done, completing (no dust refund)", {
          ...ctx,
          step: "already_swept_on_chain",
          sweepTxHash,
        });

        await markSweepCompleted(depositId, deposit.sweptAt ?? new Date(), {
          sweepTxHash,
          gasFundingTxHash: deposit.gasFundingTxHash,
        });

        return {
          depositId,
          status: SWEEP_STATUS.COMPLETED,
          sweepTxHash,
          gasFundingTxHash: deposit.gasFundingTxHash,
          gasRefundTxHash: deposit.gasRefundTxHash,
        };
      }

      logSweepEvent("Address empty — nothing to sweep", { ...ctx, step: "address_empty" });
      await markSweepCompleted(depositId, deposit.sweptAt);
      return { depositId, status: SWEEP_STATUS.COMPLETED, skipped: true };
    }

    if (balances.usdt < minUsdt) {
      logSweepEvent("On-chain USDT below minimum — skipping sweep", {
        ...ctx,
        step: "below_min_on_chain",
        amount: formatUnits(balances.usdt, USDT_DECIMALS),
      });
      await markSweepCompleted(depositId, deposit.sweptAt);
      return { depositId, status: SWEEP_STATUS.COMPLETED, skipped: true };
    }

    // ── Resume recovery: a prior sweep tx is recorded but USDT is still here ──
    // The tx never moved the funds. If it was dropped from the mempool (e.g.
    // under-priced during a gas spike), clear it so the funded re-send below
    // runs. This is safe: a dropped tx never advanced the nonce, so the new
    // send reuses the freed nonce and at most one of them can ever mine.
    if (sweepTxHash) {
      const liveness = await getTxLiveness(publicClient, sweepTxHash);
      if (liveness === "dropped") {
        logSweepEvent("Prior sweep tx dropped from mempool — re-sending", {
          ...ctx,
          step: "sweep_tx_dropped_resend",
          sweepTxHash,
        });
        await prisma.cryptoDeposit.update({
          where: { id: depositId },
          data: { sweepTxHash: null, sweepStatus: SWEEP_STATUS.FUNDING_GAS },
        });
        sweepTxHash = null;
        ctx.sweepTxHash = undefined;
      }
    }

    {
    // ── Phase 1 + 2: Pinned gas funding, then USDT sweep ──────────────────
    // ensureGasFunded re-reads balance, re-plans gas, funds the shortfall and
    // retries (max attempts) until the wallet provably affords the sweep. The
    // returned `plan` is signed VERBATIM into the sweep tx below, so its cost
    // can never exceed what we just funded — the underfunding bug cannot recur.

    if (balances.usdt > 0n && !sweepTxHash) {
      await prisma.cryptoDeposit.update({
        where: { id: depositId },
        data: { sweepStatus: SWEEP_STATUS.FUNDING_GAS },
      });

      logSweepEvent("Funding gas for USDT sweep", {
        ...ctx,
        step: "gas_funding_started",
        amount: formatUnits(balances.usdt, USDT_DECIMALS),
      });

      const funded = await ensureGasFunded({
        publicClient,
        treasury,
        depositAddress,
        receiving,
        usdtAmount: balances.usdt,
        ctx,
        waitForConfirmations,
        onFirstFundingTx: async (txHash) => {
          if (!gasFundingTxHash) {
            gasFundingTxHash = txHash;
            ctx.gasFundingTxHash = txHash;
            await prisma.cryptoDeposit.update({
              where: { id: depositId },
              data: { gasFundingTxHash },
            });
          }
        },
      });
      balances = funded.balances;
      const plan = funded.plan;

      logSweepEvent("Gas funded — wallet can afford sweep", {
        ...ctx,
        step: "gas_funding_complete",
        treasury: treasury.address,
        usdtAmount: formatUnits(balances.usdt, USDT_DECIMALS),
        gasEstimate: plan.gasLimit.toString(),
        gasPriceGwei: formatUnits(plan.gasPrice, 9),
        fundingAmount: formatUnits(plan.fundingTarget, 18),
        maxTxCost: formatUnits(plan.gasCost, 18),
        balanceAfter: formatUnits(balances.bnb, 18),
        retryCount: funded.fundingTxCount,
        gasSent: formatUnits(balances.bnb, 18),
        amount: formatUnits(plan.fundingTarget, 18),
      });

      // Idempotent claim: exactly one worker submits the sweep tx.
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
          amount: formatUnits(balances.usdt, USDT_DECIMALS),
          gasSent: formatUnits(plan.gasPrice, 9),
        });

        sweepTxHash = await sendSignedErc20Transfer(
          depositAccount,
          getUsdtTokenAddress(),
          receiving,
          balances.usdt,
          { gas: plan.gasLimit, gasPrice: plan.gasPrice }
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
    }
    } // end usdt sweep block

    // ── Phase 3: BNB refund (only when worth it — never chase dust) ───────
    let gasRefundTxHash = deposit.gasRefundTxHash as `0x${string}` | null;
    balances = await readAddressBalances(publicClient, depositAddress);

    if (!gasRefundTxHash) {
      const refundPlan = await estimateNativeTransferGas(publicClient);
      const refundGasReserve = refundPlan.fundingTarget;
      let refundAmount = refundableBnbAmount(
        balances.bnb,
        refundGasReserve,
        getMinBnbRefundWei()
      );

      if (
        refundAmount > 0n &&
        !canAffordNativeTransfer(balances.bnb, refundAmount, refundGasReserve)
      ) {
        logSweepEvent("BNB refund skipped — balance too low for safe transfer", {
          ...ctx,
          step: "refund_skip_unaffordable",
          gasSent: formatUnits(balances.bnb, 18),
        });
        refundAmount = 0n;
      }

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
          gas: refundPlan.gasLimit,
          gasPrice: refundPlan.gasPrice,
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

    await markSweepCompleted(depositId, deposit.sweptAt ?? new Date());

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

    if (isReceiptWaitTimeout(error)) {
      const latest = await prisma.cryptoDeposit.findUnique({
        where: { id: depositId },
        select: {
          sweepTxHash: true,
          gasFundingTxHash: true,
          gasRefundTxHash: true,
        },
      });
      const submittedSweep =
        latest?.sweepTxHash ?? ctx.sweepTxHash ?? deposit.sweepTxHash;
      const submittedGas =
        latest?.gasFundingTxHash ?? ctx.gasFundingTxHash ?? deposit.gasFundingTxHash;
      const submittedRefund =
        latest?.gasRefundTxHash ?? ctx.gasRefundTxHash ?? deposit.gasRefundTxHash;
      const hasSubmittedTx = submittedSweep || submittedGas || submittedRefund;

      if (hasSubmittedTx) {
        logSweepEvent("Sweep paused — tx submitted, confirmation timed out (will resume)", {
          ...ctx,
          step: "wait_timeout_resumable",
          error: message,
          durationMs,
        });
        await prisma.cryptoDeposit.update({
          where: { id: depositId },
          data: {
            sweepStatus: submittedSweep ? SWEEP_STATUS.SWEPT : SWEEP_STATUS.SWEEPING,
            sweepError: `Confirmation pending: ${message}`.slice(0, 2000),
          },
        });
        return {
          depositId,
          status: "awaiting_confirmation",
          error: message,
          sweepTxHash: submittedSweep,
          gasFundingTxHash: submittedGas,
          gasRefundTxHash: submittedRefund,
        };
      }
    }

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
