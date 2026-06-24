import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVoteWeight, tallyVotes, closeExpiredProposals } from "@/lib/governance";
import { governanceProposalSchema } from "@/lib/validations";

export async function GET() {
  await closeExpiredProposals(prisma);
  const user = await getSessionUser();

  const proposals = await prisma.governanceProposal.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      creator: { select: { displayName: true } },
      votes: { select: { userId: true, choice: true, weight: true } },
    },
  });

  const items = proposals.map((p) => {
    const myVote = user
      ? (p.votes.find((v) => v.userId === user.id)?.choice ?? null)
      : null;
    return {
      ...p,
      tally: tallyVotes(p.votes),
      myVote,
      votes: undefined,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = governanceProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const weight = await getVoteWeight(user.id, prisma);
    if (weight < 10) {
      return NextResponse.json(
        { error: "Stake at least 10 RVLT to create a proposal" },
        { status: 403 }
      );
    }

    const days = parsed.data.daysOpen ?? 7;
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + days);

    const proposal = await prisma.governanceProposal.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        creatorId: user.id,
        endsAt,
      },
    });

    return NextResponse.json({ success: true, proposal });
  } catch (error) {
    console.error("Governance proposal error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
