import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllWalletBalances } from "@/lib/wallet";
import { getDefaultCurrency } from "@/lib/currency";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balances = await getAllWalletBalances(prisma, user.id);
  const defaultCurrency = getDefaultCurrency();

  return NextResponse.json({
    balances,
    primaryBalance: balances[defaultCurrency] ?? 0,
    defaultCurrency,
  });
}
