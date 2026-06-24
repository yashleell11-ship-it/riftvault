import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVoteWeight, tallyVotes } from "@/lib/governance";
import { governanceVoteSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const proposal = await prisma.governanceProposal.findUnique({
    where: { id },
    include: {
      creator: { select: { displayName: true } },
      votes: {
        include: { user: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    proposal: {
      ...proposal,
      tally: tallyVotes(proposal.votes),
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const proposal = await prisma.governanceProposal.findUnique({ where: { id } });
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (proposal.status !== "active" || proposal.endsAt < new Date()) {
      return NextResponse.json({ error: "Voting closed" }, { status: 409 });
    }

    const body = await request.json();
    const parsed = governanceVoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const weight = await getVoteWeight(user.id, prisma);
    if (weight <= 0) {
      return NextResponse.json({ error: "Stake RVLT to vote" }, { status: 403 });
    }

    const vote = await prisma.governanceVote.upsert({
      where: { proposalId_userId: { proposalId: id, userId: user.id } },
      create: {
        proposalId: id,
        userId: user.id,
        choice: parsed.data.choice,
        weight,
      },
      update: {
        choice: parsed.data.choice,
        weight,
      },
    });

    return NextResponse.json({ success: true, vote });
  } catch (error) {
    console.error("Governance vote error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
