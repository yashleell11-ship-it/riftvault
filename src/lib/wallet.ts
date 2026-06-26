import type { Prisma } from "@prisma/client";
import { getDefaultCurrency, normalizeCurrency } from "@/lib/currency";

type Tx = Prisma.TransactionClient;

function isPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

/** Serialize balance reads/writes per user+currency (prevents double-spend races). */
async function acquireWalletLock(tx: Tx, userId: string, currency: string) {
  if (!isPostgres()) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${currency}))`;
}

export const WALLET_TX_TYPES = [
  "deposit",
  "withdraw",
  "purchase",
  "sale",
  "reward",
] as const;

export type WalletTxType = (typeof WALLET_TX_TYPES)[number];

export async function getWalletBalance(
  tx: Tx,
  userId: string,
  currency?: string
) {
  const code = normalizeCurrency(currency);
  const latest = await tx.walletTransaction.findFirst({
    where: { userId, currency: code },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

export async function getAllWalletBalances(tx: Tx, userId: string) {
  const rows = await tx.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    distinct: ["currency"],
    select: { currency: true, balanceAfter: true },
  });

  const balances: Record<string, number> = {};
  for (const row of rows) {
    balances[row.currency] = row.balanceAfter;
  }
  return balances;
}

export async function creditWallet(
  tx: Tx,
  params: {
    userId: string;
    amount: number;
    currency?: string;
    type: WalletTxType;
    status?: string;
    description?: string;
    orderId?: string;
  }
) {
  const currency = normalizeCurrency(params.currency);
  await acquireWalletLock(tx, params.userId, currency);
  const current = await getWalletBalance(tx, params.userId, currency);
  const balanceAfter = Math.round((current + params.amount) * 10000) / 10000;

  return tx.walletTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      currency,
      balanceAfter,
      status: params.status ?? "completed",
      description: params.description,
      orderId: params.orderId,
    },
  });
}

export async function debitWallet(
  tx: Tx,
  params: {
    userId: string;
    amount: number;
    currency?: string;
    type: WalletTxType;
    status?: string;
    description?: string;
    orderId?: string;
  }
) {
  const currency = normalizeCurrency(params.currency ?? getDefaultCurrency());
  await acquireWalletLock(tx, params.userId, currency);
  const current = await getWalletBalance(tx, params.userId, currency);

  if (current < params.amount) {
    throw new Error("Insufficient balance");
  }

  const balanceAfter = Math.round((current - params.amount) * 10000) / 10000;

  return tx.walletTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: -params.amount,
      currency,
      balanceAfter,
      status: params.status ?? "completed",
      description: params.description,
      orderId: params.orderId,
    },
  });
}
