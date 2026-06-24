import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRvltBalance, getStakedAmount, getRvltContractAddress } from "@/lib/token";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [available, staked, activeStakes] = await prisma.$transaction(async (tx) => {
    const bal = await getRvltBalance(tx, user.id);
    const stk = await getStakedAmount(tx, user.id);
    const stakes = await tx.tokenStake.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: { stakedAt: "desc" },
      select: { id: true, amount: true, stakedAt: true },
    });
    return [bal, stk, stakes];
  });

  return NextResponse.json({
    available,
    staked,
    total: Math.round((available + staked) * 10000) / 10000,
    activeStakes,
    contractAddress: getRvltContractAddress(),
  });
}
