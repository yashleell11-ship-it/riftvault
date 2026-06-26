import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const [users, nfts, volumeAgg, pendingWithdrawals, activeCampaigns, topCollections, recentOrders] =
    await Promise.all([
      prisma.user.count(),
      prisma.nft.count(),
      prisma.order.aggregate({
        where: { status: "completed" },
        _sum: { price: true },
        _count: { id: true },
      }),
      prisma.walletTransaction.count({ where: { type: "withdraw", status: "pending" } }),
      prisma.airdropCampaign.count({ where: { active: true } }),
      prisma.collection.findMany({
        select: { id: true, name: true, floorPrice: true, _count: { select: { nfts: true } } },
        orderBy: { floorPrice: "desc" },
        take: 5,
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

  const ordersPerDay: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    ordersPerDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of recentOrders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    if (key in ordersPerDay) ordersPerDay[key]++;
  }

  return NextResponse.json({
    summary: {
      users,
      nfts,
      pendingWithdrawals,
      activeCampaigns,
      totalVolume: volumeAgg._sum.price ?? 0,
      totalOrders: volumeAgg._count.id,
    },
    ordersPerDay: Object.entries(ordersPerDay).map(([date, count]) => ({ date, count })),
    topCollections,
  });
}
