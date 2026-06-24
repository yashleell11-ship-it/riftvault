import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDefaultCurrency } from "@/lib/currency";
import { getLevelProgress } from "@/lib/levels";
import { countCompletedTrades } from "@/lib/orders";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [aggregates, tradeCount] = await Promise.all([
    prisma.earning.groupBy({
      by: ["type"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    countCompletedTrades(prisma, user.id),
  ]);

  const tradingRewards =
    aggregates.find((row) => row.type === "trading")?._sum.amount ?? 0;
  const referralRewards =
    aggregates.find((row) => row.type === "referral")?._sum.amount ?? 0;
  const totalEarned = tradingRewards + referralRewards;
  const levelProgress = getLevelProgress(tradeCount);

  return NextResponse.json({
    totalEarned,
    tradingRewards,
    referralRewards,
    tradeCount,
    level: user.level,
    levelProgress,
    defaultCurrency: getDefaultCurrency(),
    breakdown: [
      { type: "trading", label: "Trading rewards", amount: tradingRewards },
      { type: "referral", label: "Referral rewards", amount: referralRewards },
    ],
  });
}
