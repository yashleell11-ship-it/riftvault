import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChainByKey } from "@/lib/chains";
import { depositReportSchema } from "@/lib/validations";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = depositReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { amount, currency, chainKey, txHash } = parsed.data;

    if (!getChainByKey(chainKey)) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }

    if (txHash) {
      const existing = await prisma.cryptoDeposit.findUnique({ where: { txHash } });
      if (existing) {
        return NextResponse.json({ error: "This transaction was already reported" }, { status: 409 });
      }
    }

    const deposit = await prisma.cryptoDeposit.create({
      data: {
        userId: user.id,
        chainKey,
        asset: currency,
        amount,
        txHash: txHash ?? null,
        status: "pending",
      },
    });

    await createNotification(prisma, {
      userId: user.id,
      type: "deposit",
      title: "Deposit submitted",
      body: `Your ${amount} ${currency} deposit is pending review.`,
      link: "/dashboard/wallet",
    });

    return NextResponse.json({
      success: true,
      deposit,
      message: "Deposit reported. An admin will confirm after verifying the on-chain transfer.",
    });
  } catch (error) {
    console.error("Deposit report error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
