import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { KYC_TIERS } from "@/lib/kyc";
import { kycSubmitSchema } from "@/lib/validations";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.kycProfile.findUnique({ where: { userId: user.id } });
  const tier = profile?.status === "approved" ? profile.tier : 0;
  const limits = KYC_TIERS[tier as keyof typeof KYC_TIERS] ?? KYC_TIERS[0];

  return NextResponse.json({ profile, tier, limits });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = kycSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const profile = await prisma.kycProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        legalName: parsed.data.legalName,
        country: parsed.data.country,
        status: "pending",
        submittedAt: new Date(),
      },
      update: {
        legalName: parsed.data.legalName,
        country: parsed.data.country,
        status: "pending",
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      profile,
      message: "Verification submitted. An admin will review your request.",
    });
  } catch (error) {
    console.error("KYC submit error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
