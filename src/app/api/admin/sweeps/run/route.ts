import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runSweeperTickGuarded, runSweeperUntilDone } from "@/deposits/sweeper/runner";
import { getAdminSweepBatchLimit } from "@/deposits/sweeper/config";
import { getSweeperDiagnostics } from "@/deposits/sweeper/diagnostics";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/** Run sweeper until queue empty or timeout. Default: full drain. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  logSweepEvent("Admin manual sweep started", { depositId: "—", step: "admin_run" });

  try {
    const diagnostics = await getSweeperDiagnostics();
    const { searchParams } = new URL(request.url);
    const maxLimit = getAdminSweepBatchLimit();
    const limitParam = Number(searchParams.get("limit") ?? String(maxLimit));
    const batchLimit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), maxLimit)
        : maxLimit;
    const singleTick = searchParams.get("tick") === "1";

    const result = singleTick
      ? await runSweeperTickGuarded({ limit: batchLimit, includeDiagnostics: true, batchFund: true })
      : await runSweeperUntilDone({ batchLimit, includeDiagnostics: true });

    const drained = "drained" in result ? result.drained : result.pendingFound === 0;
    const remainingPending =
      "remainingPending" in result ? result.remainingPending : result.pendingFound;
    const rounds = "rounds" in result ? result.rounds : 1;

    return NextResponse.json({
      ok: diagnostics.enabled && result.errors.length === 0 && drained,
      drained,
      remainingPending,
      rounds,
      diagnostics,
      pendingFound: result.pendingFound,
      gasFunded: result.gasFunded,
      swept: result.swept,
      refunded: result.refunded,
      batchAddressesFunded: result.batchAddressesFunded ?? 0,
      durationMs: result.durationMs,
      results: result.results,
      errors: result.errors,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    });
  } catch (error) {
    const details = serializeError(error);
    logSweepEvent("Admin manual sweep failed", {
      depositId: "—",
      step: "admin_run_error",
      error: details.stack ?? details.message,
    });
    return NextResponse.json({ ok: false, error: "Sweep failed", details }, { status: 500 });
  }
}
