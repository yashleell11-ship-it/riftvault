import { NextResponse } from "next/server";
import { authorizeCronOrVercelCli } from "@/lib/cron-auth";
import { uniqueDepositAddressesEnabled } from "@/lib/env";
import { runPaymentListenerTick } from "@/payments/listener/runner";
import { isUsdtPaymentsEnabled } from "@/payments/blockchain/config";

export const dynamic = "force-dynamic";

function isListenerEnabled() {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

export async function GET(request: Request) {
  if (!(await authorizeCronOrVercelCli(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isListenerEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_configured" });
  }

  try {
    const result = await runPaymentListenerTick({ maxBlocks: 500 });
    return NextResponse.json({ ok: true, ...result, scanned: result.scanned });
  } catch (error) {
    console.error("[cron/scan-usdt-payments]", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

export const POST = GET;
