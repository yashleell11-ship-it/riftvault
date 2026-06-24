import type { Prisma } from "@prisma/client";

export const RVLT = "RVLT" as const;

/** Testnet contract address — set NEXT_PUBLIC_RVLT_TOKEN_ADDRESS in .env */
export function getRvltContractAddress(): string | null {
  return process.env.NEXT_PUBLIC_RVLT_TOKEN_ADDRESS ?? null;
}

type Tx = Prisma.TransactionClient;

export async function getRvltBalance(tx: Tx, userId: string): Promise<number> {
  const latest = await tx.walletTransaction.findFirst({
    where: { userId, currency: RVLT },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

export async function creditRvlt(
  tx: Tx,
  params: { userId: string; amount: number; type: string; description?: string }
) {
  const current = await getRvltBalance(tx, params.userId);
  const balanceAfter = Math.round((current + params.amount) * 10000) / 10000;
  return tx.walletTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      currency: RVLT,
      balanceAfter,
      status: "completed",
      description: params.description,
    },
  });
}

export async function debitRvlt(
  tx: Tx,
  params: { userId: string; amount: number; type: string; description?: string }
) {
  const current = await getRvltBalance(tx, params.userId);
  if (current < params.amount) throw new Error("Insufficient RVLT balance");
  const balanceAfter = Math.round((current - params.amount) * 10000) / 10000;
  return tx.walletTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: -params.amount,
      currency: RVLT,
      balanceAfter,
      status: "completed",
      description: params.description,
    },
  });
}

export async function getStakedAmount(tx: Tx, userId: string): Promise<number> {
  const result = await tx.tokenStake.aggregate({
    where: { userId, status: "active" },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function formatRvlt(amount: number): Promise<string> {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} RVLT`;
}
