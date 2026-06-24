import type { Prisma } from "@prisma/client";
import { getStakedAmount } from "@/lib/token";

type Tx = Prisma.TransactionClient;

export async function getVoteWeight(userId: string, tx: Tx): Promise<number> {
  return getStakedAmount(tx, userId);
}

export function tallyVotes(
  votes: { choice: string; weight: number }[]
): { for: number; against: number } {
  return votes.reduce(
    (acc, v) => {
      if (v.choice === "for") acc.for += v.weight;
      else if (v.choice === "against") acc.against += v.weight;
      return acc;
    },
    { for: 0, against: 0 }
  );
}

export async function closeExpiredProposals(tx: Tx) {
  const now = new Date();
  const expired = await tx.governanceProposal.findMany({
    where: { status: "active", endsAt: { lt: now } },
    include: { votes: { select: { choice: true, weight: true } } },
  });

  for (const proposal of expired) {
    const tally = tallyVotes(proposal.votes);
    const status =
      tally.for > tally.against
        ? "passed"
        : tally.against > tally.for
          ? "rejected"
          : "rejected";

    await tx.governanceProposal.update({
      where: { id: proposal.id },
      data: { status },
    });
  }
}
