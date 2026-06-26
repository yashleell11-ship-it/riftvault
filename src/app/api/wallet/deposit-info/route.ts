import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getSupportedDepositOptions,
  listUserCryptoDeposits,
} from "@/lib/deposits";
import { allowDemoDeposits, uniqueDepositAddressesEnabled } from "@/lib/env";
import { ensureUserDepositAddresses } from "@/deposits/services/provision-addresses";
import { scanUserDepositTransfers } from "@/deposits/listener/deposit-scanner";
import { shouldRunThrottledScan } from "@/lib/scan-throttle";

const SCAN_INTERVAL_MS = 45_000;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scanRequested = searchParams.get("scan") === "1";

  if (
    uniqueDepositAddressesEnabled() &&
    scanRequested &&
    shouldRunThrottledScan(`deposit:${user.id}`, SCAN_INTERVAL_MS)
  ) {
    try {
      await scanUserDepositTransfers({ maxBlocks: 80 });
    } catch (error) {
      console.error("[deposit-info] scan:", error);
    }
  }

  const addresses = uniqueDepositAddressesEnabled()
    ? await ensureUserDepositAddresses(user.id)
    : [];

  const recentDeposits = await listUserCryptoDeposits(prisma, user.id, 8);

  return NextResponse.json({
    demoDepositsEnabled: allowDemoDeposits(),
    uniqueAddressesEnabled: uniqueDepositAddressesEnabled(),
    uniqueAddressesComingSoon: false,
    supportedOptions: getSupportedDepositOptions(),
    addresses,
    recentDeposits,
  });
}
