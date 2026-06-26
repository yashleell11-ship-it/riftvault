import { prisma } from "@/lib/db";
import {
  getAdminSweepBatchLimit,
  getBatchFundAddressLimit,
  getMaxSweepsPerTick,
  getSweepDrainMaxMs,
  SWEEP_STATUS,
} from "@/deposits/sweeper/config";
import { getSweeperDiagnostics } from "@/deposits/sweeper/diagnostics";
import { backfillLegacyDepositsForSweeper } from "@/deposits/sweeper/backfill";
import {
  ensureOpenDepositsForFundedAddresses,
  resetMiscompletedDepositsWithOnChainUsdt,
} from "@/deposits/sweeper/reset-miscompleted";
import { completeBelowMinDeposits, fundGasForAllPendingAddresses } from "@/deposits/sweeper/batch-fund";
import {
  countDepositsToSweep,
  findDepositsToSweep,
  sweepQueueWhere,
} from "@/deposits/sweeper/queue";
import { reconcileSiblingDepositsAtEmptyAddresses } from "@/deposits/sweeper/reconcile";
import { sweepSingleDeposit } from "@/deposits/sweeper/sweep-deposit";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export type SweeperTickResult = {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  pendingFound: number;
  gasFunded: number;
  swept: number;
  refunded: number;
  batchAddressesFunded?: number;
  durationMs: number;
  diagnostics?: Awaited<ReturnType<typeof getSweeperDiagnostics>>;
  results: {
    depositId: string;
    status: string;
    error?: string;
    gasFundingTxHash?: string | null;
    sweepTxHash?: string | null;
    gasRefundTxHash?: string | null;
  }[];
  errors: string[];
};

export type SweeperDrainResult = SweeperTickResult & {
  rounds: number;
  remainingPending: number;
  drained: boolean;
};

export { countDepositsToSweep, findDepositsToSweep, sweepQueueWhere };

/** Reset every failed sweep so drain can retry. */
export async function resetAllSweepFailures() {
  const reset = await prisma.cryptoDeposit.updateMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      sweepStatus: SWEEP_STATUS.FAILED,
    },
    data: {
      sweepStatus: SWEEP_STATUS.PENDING,
      retryCount: 0,
      sweepError: null,
    },
  });

  if (reset.count > 0) {
    logSweepEvent("Reset all sweep failures for drain", {
      depositId: "—",
      step: "reset_all_failures",
      amount: String(reset.count),
    });
  }

  return reset.count;
}

/** Reset failed sweeps that are safe to retry (RPC quirks, confirmation timeouts, etc.). */
export async function resetStaleSweepFailures() {
  const reset = await prisma.cryptoDeposit.updateMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      sweepStatus: SWEEP_STATUS.FAILED,
      OR: [
        { sweepError: { contains: "eth_sendTransaction" } },
        { sweepError: { contains: "insufficient funds for gas" } },
        { sweepError: { contains: "Insufficient BNB" } },
        { sweepError: { contains: "BNB balance too low" } },
        { sweepError: { contains: "insufficient funds for gas * price + value" } },
        { sweepError: { contains: "Timed out while waiting" } },
        { sweepError: { contains: "Confirmation pending" } },
        { sweepTxHash: { not: null } },
      ],
    },
    data: {
      sweepStatus: SWEEP_STATUS.PENDING,
      retryCount: 0,
      sweepError: null,
    },
  });

  if (reset.count > 0) {
    logSweepEvent("Reset stale sweep failures", {
      depositId: "—",
      step: "reset_stale_failures",
      amount: String(reset.count),
    });
  }

  return reset.count;
}

/** @deprecated Use resetStaleSweepFailures */
export const resetStaleSendTransactionFailures = resetStaleSweepFailures;

export async function runSweeperTick(options?: {
  limit?: number;
  includeDiagnostics?: boolean;
  batchFund?: boolean;
}): Promise<SweeperTickResult> {
  const started = Date.now();
  const errors: string[] = [];

  logSweepEvent("Sweeper tick started", { depositId: "—", step: "tick_start" });

  const diagnostics = await getSweeperDiagnostics();
  if (!diagnostics.enabled) {
    for (const err of diagnostics.errors) errors.push(err);
    logSweepEvent("Sweeper env validation failed", {
      depositId: "—",
      step: "env_validation",
      error: diagnostics.errors.join("; "),
    });
    return {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      pendingFound: 0,
      gasFunded: 0,
      swept: 0,
      refunded: 0,
      durationMs: Date.now() - started,
      diagnostics: options?.includeDiagnostics ? diagnostics : undefined,
      results: [],
      errors,
    };
  }

  logSweepEvent("Sweeper env validation passed", {
    depositId: "—",
    step: "env_validation",
    depositAddress: diagnostics.checks.receivingWallet ?? undefined,
  });

  await resetMiscompletedDepositsWithOnChainUsdt();
  await ensureOpenDepositsForFundedAddresses();
  await resetStaleSweepFailures();
  await backfillLegacyDepositsForSweeper();
  await completeBelowMinDeposits();
  await reconcileSiblingDepositsAtEmptyAddresses();

  const limit = options?.limit ?? getMaxSweepsPerTick();
  let batchAddressesFunded = 0;

  if (options?.batchFund !== false) {
    const batch = await fundGasForAllPendingAddresses(getBatchFundAddressLimit());
    if (!batch.ok && batch.error) errors.push(batch.error);
    batchAddressesFunded = batch.addressesFunded ?? 0;
  }

  const pending = await findDepositsToSweep(limit);

  logSweepEvent("Pending deposits queried", {
    depositId: "—",
    step: "pending_query",
    amount: String(pending.length),
  });

  const results: SweeperTickResult["results"] = [];
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let gasFunded = 0;
  let swept = 0;
  let refunded = 0;

  for (const { id } of pending) {
    const before = await prisma.cryptoDeposit.findUnique({
      where: { id },
      select: {
        gasFundingTxHash: true,
        sweepTxHash: true,
        gasRefundTxHash: true,
      },
    });

    const result = await sweepSingleDeposit(id);
    results.push(result);

    const after = await prisma.cryptoDeposit.findUnique({
      where: { id },
      select: {
        gasFundingTxHash: true,
        sweepTxHash: true,
        gasRefundTxHash: true,
      },
    });

    if (after?.gasFundingTxHash && after.gasFundingTxHash !== before?.gasFundingTxHash) {
      gasFunded += 1;
    }
    if (after?.sweepTxHash && after.sweepTxHash !== before?.sweepTxHash) {
      swept += 1;
    }
    if (after?.gasRefundTxHash && after.gasRefundTxHash !== before?.gasRefundTxHash) {
      refunded += 1;
    }

    if (result.error && result.status !== "awaiting_confirmation") {
      errors.push(`${id}: ${result.error}`);
    }
    if (result.skipped) skipped += 1;
    else if (result.status === SWEEP_STATUS.COMPLETED) completed += 1;
    else if (result.status === SWEEP_STATUS.FAILED) failed += 1;
    else if (result.status === "awaiting_confirmation") skipped += 1;
    else skipped += 1;
  }

  const durationMs = Date.now() - started;
  logSweepEvent("Sweeper tick completed", {
    depositId: "—",
    step: "tick_completed",
    durationMs,
    amount: String(pending.length),
  });

  return {
    processed: pending.length,
    completed,
    failed,
    skipped,
    pendingFound: pending.length,
    gasFunded,
    swept,
    refunded,
    batchAddressesFunded,
    durationMs,
    diagnostics: options?.includeDiagnostics ? diagnostics : undefined,
    results,
    errors,
  };
}

/** Loop sweeper ticks until queue empty or wall time exceeded. */
export async function runSweeperUntilDone(options?: {
  batchLimit?: number;
  maxWallMs?: number;
  includeDiagnostics?: boolean;
}): Promise<SweeperDrainResult> {
  const started = Date.now();
  const batchLimit = options?.batchLimit ?? getAdminSweepBatchLimit();
  const maxWallMs = options?.maxWallMs ?? getSweepDrainMaxMs();

  await resetAllSweepFailures();
  await resetMiscompletedDepositsWithOnChainUsdt();
  await ensureOpenDepositsForFundedAddresses();
  await backfillLegacyDepositsForSweeper();
  await resetStaleSweepFailures();
  await completeBelowMinDeposits();
  await reconcileSiblingDepositsAtEmptyAddresses();

  let rounds = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalGasFunded = 0;
  let totalSwept = 0;
  let totalRefunded = 0;
  let totalBatchFunded = 0;
  let totalProcessed = 0;
  const allResults: SweeperTickResult["results"] = [];
  const allErrors: string[] = [];
  let diagnostics: SweeperTickResult["diagnostics"];
  let stuckRounds = 0;

  while (Date.now() - started < maxWallMs) {
    const remainingBefore = await countDepositsToSweep();
    if (remainingBefore === 0) break;

    rounds += 1;
    const tick = await runSweeperTick({
      limit: batchLimit,
      batchFund: true,
      includeDiagnostics: rounds === 1 || options?.includeDiagnostics,
    });

    if (tick.diagnostics) diagnostics = tick.diagnostics;
    totalCompleted += tick.completed;
    totalFailed += tick.failed;
    totalSkipped += tick.skipped;
    totalGasFunded += tick.gasFunded;
    totalSwept += tick.swept;
    totalRefunded += tick.refunded;
    totalBatchFunded += tick.batchAddressesFunded ?? 0;
    totalProcessed += tick.processed;
    allResults.push(...tick.results);
    for (const err of tick.errors) {
      if (!allErrors.includes(err)) allErrors.push(err);
    }

    const remainingAfter = await countDepositsToSweep();
    if (remainingAfter === 0) break;

    if (remainingAfter === remainingBefore && tick.completed === 0) {
      stuckRounds += 1;
      if (stuckRounds >= 2) {
        logSweepEvent("Drain stopped — queue not progressing", {
          depositId: "—",
          step: "drain_stuck",
          amount: String(remainingAfter),
        });
        break;
      }
      await resetAllSweepFailures();
    } else {
      stuckRounds = 0;
    }

    if (tick.processed === 0) break;
  }

  const remainingPending = await countDepositsToSweep();
  const durationMs = Date.now() - started;

  logSweepEvent("Sweeper drain finished", {
    depositId: "—",
    step: "drain_done",
    durationMs,
    amount: String(remainingPending),
  });

  return {
    processed: totalProcessed,
    completed: totalCompleted,
    failed: totalFailed,
    skipped: totalSkipped,
    pendingFound: remainingPending,
    gasFunded: totalGasFunded,
    swept: totalSwept,
    refunded: totalRefunded,
    batchAddressesFunded: totalBatchFunded,
    durationMs,
    diagnostics,
    results: allResults,
    errors: allErrors,
    rounds,
    remainingPending,
    drained: remainingPending === 0,
  };
}
