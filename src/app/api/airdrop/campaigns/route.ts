import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAirdropEligibility } from "@/lib/airdrop";

export async function GET() {
  const user = await getSessionUser();

  const campaigns = await prisma.airdropCampaign.findMany({
    where: { active: true },
    orderBy: { startsAt: "desc" },
    include: {
      _count: { select: { claims: true } },
      claims: user
        ? {
            where: { userId: user.id },
            select: { id: true, claimedAt: true, amount: true },
          }
        : false,
    },
  });

  const items = campaigns.map((campaign) => {
    const userClaim = user && Array.isArray(campaign.claims) ? campaign.claims[0] : null;
    const eligibility = user
      ? checkAirdropEligibility(
          campaign,
          user,
          campaign._count.claims,
          Boolean(userClaim)
        )
      : { eligible: false, reason: "Sign in to check eligibility" };

    return {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      description: campaign.description,
      tokenAmount: campaign.tokenAmount,
      currency: campaign.currency,
      minLevel: campaign.minLevel,
      requiresEmailVerified: campaign.requiresEmailVerified,
      maxClaims: campaign.maxClaims,
      claimCount: campaign._count.claims,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      eligible: eligibility.eligible,
      eligibilityReason: eligibility.reason,
      claimed: Boolean(userClaim),
      claim: userClaim,
    };
  });

  let claimHistory: {
    id: string;
    amount: number;
    currency: string;
    claimedAt: Date;
    campaign: { name: string; slug: string };
  }[] = [];

  if (user) {
    claimHistory = await prisma.airdropClaim.findMany({
      where: { userId: user.id },
      orderBy: { claimedAt: "desc" },
      include: {
        campaign: { select: { name: true, slug: true } },
      },
    });
  }

  return NextResponse.json({ campaigns: items, claimHistory });
}
