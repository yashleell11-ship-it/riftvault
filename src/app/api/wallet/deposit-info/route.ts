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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uniqueEnabled = uniqueDepositAddressesEnabled();
  const { searchParams } = new URL(request.url);
  const scanRequested = searchParams.get("scan") === "1";

  if (
    uniqueEnabled &&
    scanRequested &&
    shouldRunThrottledScan(`deposit:${user.id}`, SCAN_INTERVAL_MS)
  ) {
    try {
      await scanUserDepositTransfers({ maxBlocks: 80 });
    } catch (error) {
      console.error("[deposit-info] scan:", error);
    }
  }

  let addresses: Awaited<ReturnType<typeof ensureUserDepositAddresses>> = [];
  let addressProvisionError: string | null = null;

  if (uniqueEnabled) {
    try {
      addresses = await ensureUserDepositAddresses(user.id);
    } catch (error) {
      console.error("[deposit-info] provision:", error);
      addressProvisionError =
        "Could not generate your deposit address. Please refresh or contact support.";
    }
  }

  const recentDeposits = await listUserCryptoDeposits(prisma, user.id, 8);

  return NextResponse.json({
    demoDepositsEnabled: allowDemoDeposits(),
    uniqueAddressesEnabled: uniqueEnabled,
    uniqueAddressesComingSoon: false,
    supportedOptions: getSupportedDepositOptions(),
    addresses,
    addressProvisionError,
    recentDeposits,
  });
}
