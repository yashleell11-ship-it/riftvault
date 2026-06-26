import { NextResponse } from "next/server";
import { uniqueDepositAddressesEnabled } from "@/lib/env";
import { runPaymentListenerTick } from "@/payments/listener/runner";
import { isUsdtPaymentsEnabled } from "@/payments/blockchain/config";

function isListenerEnabled() {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
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
