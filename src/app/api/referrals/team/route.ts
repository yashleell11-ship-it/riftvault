import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const directReferrals = await prisma.user.findMany({
    where: { referredById: user.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      level: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const directIds = directReferrals.map((r) => r.id);

  const indirectReferrals =
    directIds.length > 0
      ? await prisma.user.findMany({
          where: { referredById: { in: directIds } },
          select: {
            id: true,
            displayName: true,
            email: true,
            level: true,
            createdAt: true,
            referredById: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const referralEarnings = await prisma.earning.findMany({
    where: { userId: user.id, type: "referral" },
    select: { amount: true, order: { select: { buyerId: true } } },
  });

  const earningsByBuyer = new Map<string, number>();
  for (const row of referralEarnings) {
    const buyerId = row.order?.buyerId;
    if (!buyerId) continue;
    earningsByBuyer.set(
      buyerId,
      (earningsByBuyer.get(buyerId) ?? 0) + row.amount
    );
  }

  const totalReferralEarnings = referralEarnings.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({
    direct: directReferrals.map((member) => ({
      ...member,
      level: 1 as const,
      earningsFromMember: earningsByBuyer.get(member.id) ?? 0,
    })),
    indirect: indirectReferrals.map((member) => ({
      ...member,
      level: 2 as const,
      earningsFromMember: earningsByBuyer.get(member.id) ?? 0,
    })),
    totals: {
      directCount: directReferrals.length,
      indirectCount: indirectReferrals.length,
      teamCount: directReferrals.length + indirectReferrals.length,
      referralEarnings: totalReferralEarnings,
    },
  });
}
