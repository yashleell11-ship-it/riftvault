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

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (uniqueDepositAddressesEnabled()) {
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
