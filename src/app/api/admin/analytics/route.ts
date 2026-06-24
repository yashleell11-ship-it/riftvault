import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [users, nfts, orders, pendingWithdrawals, activeCampaigns, topCollections] = await Promise.all([
    prisma.user.count(),
    prisma.nft.count(),
    prisma.order.findMany({ select: { price: true, currency: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.walletTransaction.count({ where: { type: "withdraw", status: "pending" } }),
    prisma.airdropCampaign.count({ where: { active: true } }),
    prisma.collection.findMany({
      select: { id: true, name: true, floorPrice: true, _count: { select: { nfts: true } } },
      orderBy: { floorPrice: "desc" },
      take: 5,
    }),
  ]);

  const totalVolume = orders.reduce((sum, o) => sum + o.price, 0);

  // Orders per day (last 14 days)
  const now = Date.now();
  const ordersPerDay: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    ordersPerDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of orders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    if (key in ordersPerDay) ordersPerDay[key]++;
  }

  return NextResponse.json({
    summary: { users, nfts, pendingWithdrawals, activeCampaigns, totalVolume, totalOrders: orders.length },
    ordersPerDay: Object.entries(ordersPerDay).map(([date, count]) => ({ date, count })),
    topCollections,
  });
}
