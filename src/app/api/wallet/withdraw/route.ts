import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { walletWithdrawSchema } from "@/lib/validations";
import { debitWallet, getWalletBalance } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";
import { assertWithdrawAllowed } from "@/lib/kyc";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = walletWithdrawSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { amount, currency } = parsed.data;
    const code = normalizeCurrency(currency);

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { withdrawWalletAddress: true },
    });

    if (!profile?.withdrawWalletAddress) {
      return NextResponse.json(
        { error: "Set your withdrawal wallet address in the header before requesting a withdrawal." },
        { status: 400 }
      );
    }

    const tx = await prisma.$transaction(async (db) => {
      await assertWithdrawAllowed(user.id, amount, code, db);

      const balance = await getWalletBalance(db, user.id, code);
      if (balance < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      return debitWallet(db, {
        userId: user.id,
        amount,
        currency: code,
        type: "withdraw",
        status: "pending",
        description: `Withdrawal to ${profile.withdrawWalletAddress}`,
      });
    });

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("KYC_LIMIT_TX:")) {
      const limit = error.message.split(":")[1];
      return NextResponse.json(
        { error: `Withdrawal exceeds KYC per-transaction limit (${limit}). Verify your identity.` },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message.startsWith("KYC_LIMIT_DAILY:")) {
      const limit = error.message.split(":")[1];
      return NextResponse.json(
        { error: `Daily withdrawal limit reached (${limit}). Upgrade KYC tier or try tomorrow.` },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Insufficient balance") {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Withdraw error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
