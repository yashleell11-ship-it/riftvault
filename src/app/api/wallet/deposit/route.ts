import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { walletDepositSchema } from "@/lib/validations";
import { creditWallet } from "@/lib/wallet";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = walletDepositSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { amount, currency } = parsed.data;

    const tx = await prisma.$transaction(async (db) =>
      creditWallet(db, {
        userId: user.id,
        amount,
        currency,
        type: "deposit",
        description: "Simulated deposit (pre-chain)",
      })
    );

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    console.error("Deposit error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
