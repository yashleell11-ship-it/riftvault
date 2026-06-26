import type { Prisma } from "@prisma/client";
import { CHAINS } from "@/lib/chains";
import { CURRENCY_CODES } from "@/lib/currency";

export const DEPOSIT_ASSETS = CURRENCY_CODES;

export type DepositAssetOption = {
  chainKey: string;
  chainName: string;
  assets: string[];
};

export function getSupportedDepositOptions(): DepositAssetOption[] {
  return CHAINS.map((chain) => ({
    chainKey: chain.key,
    chainName: chain.name,
    assets: [...DEPOSIT_ASSETS],
  }));
}

export async function listUserDepositAddresses(
  db: Prisma.TransactionClient | typeof import("@/lib/db").prisma,
  userId: string
) {
  return db.userDepositAddress.findMany({
    where: { userId },
    orderBy: [{ chainKey: "asc" }, { asset: "asc" }],
  });
}

export async function listUserCryptoDeposits(
  db: Prisma.TransactionClient | typeof import("@/lib/db").prisma,
  userId: string,
  limit = 10
) {
  return db.cryptoDeposit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
