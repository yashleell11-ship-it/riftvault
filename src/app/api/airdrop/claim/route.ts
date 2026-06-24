import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { airdropClaimSchema } from "@/lib/validations";
import { checkAirdropEligibility } from "@/lib/airdrop";
import { creditWallet } from "@/lib/wallet";
import { creditRvlt, RVLT } from "@/lib/token";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = airdropClaimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { campaignId } = parsed.data;

    const campaign = await prisma.airdropCampaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { claims: true } } },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const existingClaim = await prisma.airdropClaim.findUnique({
      where: {
        campaignId_userId: { campaignId, userId: user.id },
      },
    });

    const eligibility = checkAirdropEligibility(
      campaign,
      user,
      campaign._count.claims,
      Boolean(existingClaim)
    );

    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.reason ?? "Not eligible" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.airdropClaim.create({
        data: {
          campaignId,
          userId: user.id,
          amount: campaign.tokenAmount,
          currency: campaign.currency,
        },
      });

      const walletTx =
        campaign.currency === RVLT
          ? await creditRvlt(tx, {
              userId: user.id,
              amount: campaign.tokenAmount,
              type: "reward",
              description: `Airdrop: ${campaign.name}`,
            })
          : await creditWallet(tx, {
              userId: user.id,
              amount: campaign.tokenAmount,
              currency: campaign.currency,
              type: "reward",
              description: `Airdrop: ${campaign.name}`,
            });

      return { claim, walletTx };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Airdrop claim error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
