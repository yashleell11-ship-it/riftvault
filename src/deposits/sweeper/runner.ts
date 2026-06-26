import { prisma } from "@/lib/db";
import {
  getMaxSweepsPerTick,
  getMaxSweepRetries,
  isDepositSweeperEnabled,
  SWEEP_STATUS,
} from "@/deposits/sweeper/config";
import { sweepSingleDeposit } from "@/deposits/sweeper/sweep-deposit";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export type SweeperTickResult = {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  results: { depositId: string; status: string; error?: string }[];
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
    select: { id: true },
  });
}

export async function runSweeperTick(): Promise<SweeperTickResult> {
  if (!isDepositSweeperEnabled()) {
    logSweepEvent("Sweeper disabled or not configured", {
      depositId: "—",
      step: "disabled",
    });
    return { processed: 0, completed: 0, failed: 0, skipped: 0, results: [] };
  }

  const limit = getMaxSweepsPerTick();
  const pending = await findDepositsToSweep(limit);

  const results: SweeperTickResult["results"] = [];
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of pending) {
    const result = await sweepSingleDeposit(id);
    results.push(result);
    if (result.skipped) skipped += 1;
    else if (result.status === SWEEP_STATUS.COMPLETED) completed += 1;
    else if (result.status === SWEEP_STATUS.FAILED) failed += 1;
    else skipped += 1;
  }

  return {
    processed: pending.length,
    completed,
    failed,
    skipped,
    results,
  };
}
