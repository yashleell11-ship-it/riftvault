import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { verifyTreasuryWalletMatch } from "@/deposits/sweeper/diagnostics";

/** Same check as `new ethers.Wallet(TREASURY_PRIVATE_KEY).address === RECEIVING_WALLET` */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(verifyTreasuryWalletMatch());
}
