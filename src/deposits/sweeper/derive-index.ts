import { prisma } from "@/lib/db";
import { deriveDepositAddress } from "@/deposits/blockchain/derive-address";
import { getDepositMnemonic } from "@/deposits/blockchain/config";
import { depositAddressEquals } from "@/deposits/sweeper/queue";

const indexCache = new Map<string, number | null>();

/** Upper bound when scanning HD indices for an address not yet in the DB. */
export function getMaxDerivationScanIndex(): number {
  const n = Number(process.env.SWEEPER_MAX_DERIVATION_SCAN ?? 500);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500;
}

async function getDerivationScanUpperBound(): Promise<number> {
  const agg = await prisma.userDepositAddress.aggregate({ _max: { derivationIndex: true } });
  const fromDb = agg._max.derivationIndex ?? -1;
  return Math.min(
    getMaxDerivationScanIndex(),
    Math.max(fromDb + 10, 100)
  );
}

/**
 * Resolve BIP44 index for a deposit address — DB first, then HD scan.
 * Returns null when the address is not from DEPOSIT_MNEMONIC.
 */
export async function findDerivationIndexForAddress(
  address: string
): Promise<number | null> {
  const normalized = address.toLowerCase();
  if (indexCache.has(normalized)) {
    return indexCache.get(normalized) ?? null;
  }

  const row = await prisma.userDepositAddress.findFirst({
    where: { address: depositAddressEquals(normalized) },
    select: { derivationIndex: true },
  });
  if (row) {
    indexCache.set(normalized, row.derivationIndex);
    return row.derivationIndex;
  }

  if (!getDepositMnemonic()) {
    indexCache.set(normalized, null);
    return null;
  }

  const upper = await getDerivationScanUpperBound();
  for (let i = 0; i <= upper; i++) {
    if (deriveDepositAddress(i).toLowerCase() === normalized) {
      indexCache.set(normalized, i);
      return i;
    }
  }

  indexCache.set(normalized, null);
  return null;
}

export async function resolveDerivationIndexForDeposit(
  depositId: string,
  toAddress: string | null
): Promise<number | null> {
  if (!toAddress) return null;

  const fromAddress = await findDerivationIndexForAddress(toAddress);
  if (fromAddress != null) return fromAddress;

  const deposit = await prisma.cryptoDeposit.findUnique({
    where: { id: depositId },
    select: { userId: true, chainKey: true, asset: true },
  });
  if (!deposit) return null;

  const byUser = await prisma.userDepositAddress.findFirst({
    where: {
      userId: deposit.userId,
      chainKey: deposit.chainKey,
      asset: deposit.asset,
    },
    select: { derivationIndex: true, address: true },
  });

  if (byUser && byUser.address.toLowerCase() === toAddress.toLowerCase()) {
    return byUser.derivationIndex;
  }

  return null;
}
