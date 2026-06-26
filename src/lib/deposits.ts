import type { Prisma } from "@prisma/client";
import { CHAINS } from "@/lib/chains";
import { CURRENCY_CODES } from "@/lib/currency";
import { DEPOSIT_BSC_CHAIN_KEY } from "@/deposits/blockchain/config";
import { uniqueDepositAddressesEnabled } from "@/lib/env";

export const DEPOSIT_ASSETS = CURRENCY_CODES;

export type DepositAssetOption = {
  chainKey: string;
  chainName: string;
  assets: string[];
};

export function getSupportedDepositOptions(): DepositAssetOption[] {
  if (uniqueDepositAddressesEnabled()) {
    const bsc = CHAINS.find((c) => c.key === DEPOSIT_BSC_CHAIN_KEY);
    if (bsc) {
      return [{ chainKey: bsc.key, chainName: bsc.name, assets: ["USDT"] }];
    }
  }
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
