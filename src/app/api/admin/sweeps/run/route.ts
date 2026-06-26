import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runSweeperTick } from "@/deposits/sweeper/runner";
import { getSweeperDiagnostics } from "@/deposits/sweeper/diagnostics";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/** Run one sweeper tick immediately (admin). */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  logSweepEvent("Admin manual sweep started", { depositId: "—", step: "admin_run" });

  try {
    const diagnostics = await getSweeperDiagnostics();
    const result = await runSweeperTick({ limit: 1, includeDiagnostics: true });

    return NextResponse.json({
      ok: diagnostics.enabled && result.errors.length === 0,
      diagnostics,
      pendingFound: result.pendingFound,
      gasFunded: result.gasFunded,
      swept: result.swept,
      refunded: result.refunded,
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
