import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bought, sold, earnings, ownedNfts, rvltTxs] = await Promise.all([
    prisma.order.findMany({ where: { buyerId: user.id }, select: { price: true, currency: true, createdAt: true } }),
    prisma.order.findMany({ where: { sellerId: user.id }, select: { price: true, currency: true, createdAt: true } }),
    prisma.earning.findMany({ where: { userId: user.id }, select: { amount: true, currency: true, type: true } }),
    prisma.nft.count({ where: { ownerId: user.id } }),
    prisma.walletTransaction.findMany({ where: { userId: user.id, currency: "RVLT" }, select: { amount: true, type: true } }),
  ]);

  const totalSpent = bought.reduce((s, o) => s + o.price, 0);
  const totalEarned = sold.reduce((s, o) => s + o.price, 0);
  const totalRewards = earnings.reduce((s, e) => s + e.amount, 0);
  const tradingRewards = earnings.filter(e => e.type === "trading").reduce((s, e) => s + e.amount, 0);
  const referralRewards = earnings.filter(e => e.type === "referral").reduce((s, e) => s + e.amount, 0);
  const rvltBalance = rvltTxs.reduce((s, t) => s + t.amount, 0);
  const pnl = totalEarned - totalSpent + totalRewards;

  return NextResponse.json({
    totalSpent,
    totalEarned,
    totalRewards,
    tradingRewards,
    referralRewards,
    pnl,
    ownedNfts,
    totalTrades: bought.length + sold.length,
    buyCount: bought.length,
    sellCount: sold.length,
    rvltBalance,
  });
}
