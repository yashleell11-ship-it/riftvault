import { NextResponse } from "next/server";
import { authorizeCronOrVercelCli } from "@/lib/cron-auth";
import { runSweeperTick } from "@/deposits/sweeper/runner";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : error.cause,
    };
  }
  return { message: String(error) };
}

export async function GET(request: Request) {
  logSweepEvent("Cron route entered", { depositId: "—", step: "route_entered" });

  if (!(await authorizeCronOrVercelCli(request))) {
    logSweepEvent("Cron unauthorized", { depositId: "—", step: "auth", error: "401" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSweeperTick({ includeDiagnostics: true });

    if (!result.errors.length && result.pendingFound === 0 && result.processed === 0) {
      return NextResponse.json({
        ok: true,
        skippedTick: result.diagnostics?.enabled === false,
        reason: result.diagnostics?.enabled === false ? "sweeper_not_configured" : "no_pending",
        ...result,
      });
    }

    if (result.errors.length && result.processed === 0) {
      return NextResponse.json({
        ok: false,
        skippedTick: true,
        reason: "sweeper_config_invalid",
        ...result,
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const details = serializeError(error);
    logSweepEvent("Cron route exception", {
      depositId: "—",
      step: "route_exception",
      error: details.stack ?? details.message,
    });
    console.error("[cron/sweep-deposits]", error);
    return NextResponse.json(
      { ok: false, error: "Sweep failed", details },
      { status: 500 }
    );
  }
}

export const POST = GET;
