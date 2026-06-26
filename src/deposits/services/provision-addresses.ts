import { prisma } from "@/lib/db";
import { DEPOSIT_ROUTES } from "@/deposits/blockchain/config";
import { deriveDepositAddress } from "@/deposits/blockchain/derive-address";

async function nextDerivationIndex(): Promise<number> {
  const agg = await prisma.userDepositAddress.aggregate({
    _max: { derivationIndex: true },
  });
  return (agg._max.derivationIndex ?? -1) + 1;
}

/** Create missing per-user deposit addresses (idempotent). */
export async function ensureUserDepositAddresses(userId: string) {
  const created = [];

  for (const route of DEPOSIT_ROUTES) {
    const existing = await prisma.userDepositAddress.findUnique({
      where: {
        userId_chainKey_asset: {
          userId,
          chainKey: route.chainKey,
          asset: route.asset,
        },
      },
    });

    if (existing) continue;

    const derivationIndex = await nextDerivationIndex();
    const address = deriveDepositAddress(derivationIndex).toLowerCase();

    const row = await prisma.userDepositAddress.create({
      data: {
        userId,
        chainKey: route.chainKey,
        asset: route.asset,
        address,
        derivationIndex,
      },
    });

    created.push(row);
  }

  return prisma.userDepositAddress.findMany({
    where: { userId },
    orderBy: [{ chainKey: "asc" }, { asset: "asc" }],
  });
}

export async function getAddressOwnerMap(): Promise<
  Map<string, { userId: string; chainKey: string; asset: string }>
> {
  const rows = await prisma.userDepositAddress.findMany({
    select: { address: true, userId: true, chainKey: true, asset: true },
  });

  const map = new Map<string, { userId: string; chainKey: string; asset: string }>();
  for (const row of rows) {
    map.set(row.address.toLowerCase(), {
      userId: row.userId,
      chainKey: row.chainKey,
      asset: row.asset,
    });
  }
  return map;
}
