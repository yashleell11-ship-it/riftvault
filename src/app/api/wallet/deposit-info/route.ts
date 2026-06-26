import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getSupportedDepositOptions,
  listUserCryptoDeposits,
  listUserDepositAddresses,
} from "@/lib/deposits";
import { allowDemoDeposits, uniqueDepositAddressesEnabled } from "@/lib/env";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [addresses, pendingDeposits] = await Promise.all([
    listUserDepositAddresses(prisma, user.id),
    listUserCryptoDeposits(prisma, user.id, 5),
  ]);

  return NextResponse.json({
    demoDepositsEnabled: allowDemoDeposits(),
    uniqueAddressesEnabled: uniqueDepositAddressesEnabled(),
    uniqueAddressesComingSoon: !uniqueDepositAddressesEnabled(),
    supportedOptions: getSupportedDepositOptions(),
    addresses,
    recentDeposits: pendingDeposits,
  });
}
