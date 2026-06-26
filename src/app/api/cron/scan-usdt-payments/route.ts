import { NextResponse } from "next/server";
import { authorizeCronOrVercelCli } from "@/lib/cron-auth";
import { uniqueDepositAddressesEnabled } from "@/lib/env";
import { runPaymentListenerTick } from "@/payments/listener/runner";
import { isUsdtPaymentsEnabled } from "@/payments/blockchain/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isListenerEnabled() {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

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
  if (!(await authorizeCronOrVercelCli(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isListenerEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_configured" });
  }

  try {
    const result = await runPaymentListenerTick({ maxBlocks: 15, skipDeposits: true });
    return NextResponse.json({ ok: true, ...result, scanned: result.scanned });
  } catch (error) {
    const details = serializeError(error);
    console.error("[cron/scan-usdt-payments]", error);
    return NextResponse.json(
      { ok: false, error: "Scan failed", details },
      { status: 500 }
    );
  }
}

export const POST = GET;
