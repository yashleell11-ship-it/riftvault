import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReferralLink } from "@/lib/earn";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const directIds = await prisma.user.findMany({
    where: { referredById: user.id },
    select: { id: true },
  });

  const indirectCount =
    directIds.length > 0
      ? await prisma.user.count({
          where: { referredById: { in: directIds.map((d) => d.id) } },
        })
      : 0;

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: buildReferralLink(user.referralCode),
    teamCount: directIds.length + indirectCount,
    directCount: directIds.length,
    indirectCount,
  });
}
