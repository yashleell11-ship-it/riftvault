import { prisma } from "@/lib/db";
import {
  getMaxSweepsPerTick,
  getMaxSweepRetries,
  SWEEP_STATUS,
} from "@/deposits/sweeper/config";
import { getSweeperDiagnostics } from "@/deposits/sweeper/diagnostics";
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

/** Find confirmed, credited deposits that still need on-chain consolidation. */
export async function findDepositsToSweep(limit: number) {
  const maxRetries = getMaxSweepRetries();

  return prisma.cryptoDeposit.findMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
      OR: [
        { sweepStatus: null },
        { sweepStatus: SWEEP_STATUS.PENDING },
        { sweepStatus: SWEEP_STATUS.FAILED, retryCount: { lt: maxRetries } },
        { sweepStatus: SWEEP_STATUS.FUNDING_GAS },
        { sweepStatus: SWEEP_STATUS.SWEEPING },
        { sweepStatus: SWEEP_STATUS.SWEPT },
        { sweepStatus: SWEEP_STATUS.REFUNDING },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, sweepStatus: true },
  });
}

export async function runSweeperTick(options?: {
  limit?: number;
  includeDiagnostics?: boolean;
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

  const limit = options?.limit ?? getMaxSweepsPerTick();
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

    if (result.error) errors.push(`${id}: ${result.error}`);
    if (result.skipped) skipped += 1;
    else if (result.status === SWEEP_STATUS.COMPLETED) completed += 1;
    else if (result.status === SWEEP_STATUS.FAILED) failed += 1;
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
    durationMs,
    diagnostics: options?.includeDiagnostics ? diagnostics : undefined,
    results,
    errors,
  };
}
