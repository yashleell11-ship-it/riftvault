import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { creditRvlt } from "@/lib/token";

const unstakeSchema = z.object({
  stakeId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = unstakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { stakeId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stake = await tx.tokenStake.findFirst({
        where: { id: stakeId, userId: user.id, status: "active" },
      });
      if (!stake) throw new Error("Stake not found or already unstaked");

      await tx.tokenStake.update({
        where: { id: stakeId },
        data: { status: "unstaked", unstakedAt: new Date() },
      });

      await creditRvlt(tx, {
        userId: user.id,
        amount: stake.amount,
        type: "unstake",
        description: `Unstaked ${stake.amount} RVLT`,
      });

      return { amount: stake.amount };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to unstake";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
