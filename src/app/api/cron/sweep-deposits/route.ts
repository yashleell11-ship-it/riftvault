import { NextResponse } from "next/server";
import { authorizeCronOrVercelCli } from "@/lib/cron-auth";
import { runSweeperTick } from "@/deposits/sweeper/runner";
import { isDepositSweeperEnabled } from "@/deposits/sweeper/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export async function GET(request: Request) {
  if (!(await authorizeCronOrVercelCli(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDepositSweeperEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "sweeper_not_configured" });
  }

  try {
    const result = await runSweeperTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/sweep-deposits]", error);
    return NextResponse.json(
      { ok: false, error: "Sweep failed", details: serializeError(error) },
      { status: 500 }
    );
  }
}

export const POST = GET;
