import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export const KYC_TIERS = {
  0: { label: "Unverified", perTx: 100, daily: 500 },
  1: { label: "Basic", perTx: 5_000, daily: 25_000 },
  2: { label: "Enhanced", perTx: 1_000_000, daily: 1_000_000 },
} as const;

export type KycTier = keyof typeof KYC_TIERS;

export async function getKycProfile(userId: string, tx: Tx = prisma) {
  return tx.kycProfile.findUnique({ where: { userId } });
}

export async function getEffectiveKycTier(userId: string, tx: Tx = prisma): Promise<KycTier> {
  const profile = await getKycProfile(userId, tx);
  if (!profile || profile.status !== "approved") return 0;
  const tier = profile.tier as KycTier;
  return tier in KYC_TIERS ? tier : 0;
}

export async function getWithdrawnToday(
  userId: string,
  currency: string,
  tx: Tx = prisma
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await tx.walletTransaction.findMany({
    where: {
      userId,
      currency,
      type: "withdraw",
      status: { in: ["pending", "completed"] },
      createdAt: { gte: start },
    },
    select: { amount: true },
  });

  return rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
}

export async function assertWithdrawAllowed(
  userId: string,
  amount: number,
  currency: string,
  tx: Tx = prisma
) {
  const tier = await getEffectiveKycTier(userId, tx);
  const limits = KYC_TIERS[tier];

  if (amount > limits.perTx) {
    throw new Error(`KYC_LIMIT_TX:${limits.perTx}`);
  }

  const withdrawnToday = await getWithdrawnToday(userId, currency, tx);
  if (withdrawnToday + amount > limits.daily) {
    throw new Error(`KYC_LIMIT_DAILY:${limits.daily}`);
  }
}
