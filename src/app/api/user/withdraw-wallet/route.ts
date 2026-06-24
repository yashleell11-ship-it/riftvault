import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { normalizeCryptoAddress } from "@/lib/crypto-address";
import { prisma } from "@/lib/db";
import { withdrawWalletSchema } from "@/lib/validations";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    address: user.withdrawWalletAddress ?? null,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = withdrawWalletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid address" },
        { status: 400 }
      );
    }

    const address = normalizeCryptoAddress(parsed.data.address);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { withdrawWalletAddress: address },
      select: {
        id: true,
        email: true,
        displayName: true,
        level: true,
        referralCode: true,
        walletAddress: true,
        withdrawWalletAddress: true,
        emailVerified: true,
        role: true,
        frozen: true,
        isCreator: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      address: updated.withdrawWalletAddress,
      user: updated,
    });
  } catch (error) {
    console.error("Withdraw wallet update error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
