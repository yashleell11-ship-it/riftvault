import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRvltBalance, debitRvlt } from "@/lib/token";

const stakeSchema = z.object({
  amount: z.number().positive().max(1_000_000),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = stakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const balance = await getRvltBalance(tx, user.id);
      if (balance < amount) throw new Error("Insufficient RVLT balance");

      await debitRvlt(tx, {
        userId: user.id,
        amount,
        type: "stake",
        description: `Staked ${amount} RVLT`,
      });

      const stake = await tx.tokenStake.create({
        data: { userId: user.id, amount, status: "active" },
      });

      return stake;
    });

    return NextResponse.json({ success: true, stake: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to stake";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
