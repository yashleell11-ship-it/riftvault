import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVoteWeight } from "@/lib/governance";
import { getRvltBalance } from "@/lib/token";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [voteWeight, rvltBalance] = await Promise.all([
    getVoteWeight(user.id, prisma),
    getRvltBalance(prisma, user.id),
  ]);

  return NextResponse.json({
    voteWeight,
    rvltBalance,
    canPropose: voteWeight >= 10,
    canVote: voteWeight > 0,
  });
}
