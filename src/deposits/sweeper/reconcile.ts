import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { readAddressBalances } from "@/deposits/sweeper/address-sweep";
import { depositAddressEquals } from "@/deposits/sweeper/queue";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { logSweepEvent } from "@/deposits/sweeper/logger";

type SweepReference = {
  sweepTxHash: string | null;
  gasFundingTxHash: string | null;
  sweptAt: Date | null;
};

async function findSweepReference(addr: string): Promise<SweepReference | null> {
  const withTx = await prisma.cryptoDeposit.findFirst({
    where: {
      toAddress: depositAddressEquals(addr),
      status: "confirmed",
      sweepTxHash: { not: null },
    },
    orderBy: [{ sweptAt: "desc" }, { updatedAt: "desc" }],
    select: {
      sweepTxHash: true,
      gasFundingTxHash: true,
      sweptAt: true,
    },
  });
  if (withTx) return withTx;

  const completed = await prisma.cryptoDeposit.findFirst({
    where: {
      toAddress: depositAddressEquals(addr),
      status: "confirmed",
      sweepStatus: SWEEP_STATUS.COMPLETED,
    },
    orderBy: [{ sweptAt: "desc" }, { updatedAt: "desc" }],
    select: {
      sweepTxHash: true,
      gasFundingTxHash: true,
      sweptAt: true,
    },
  });
  return completed;
}

/**
 * When an HD address has no USDT left (already swept), mark every open
 * deposit row at that address completed — copies sibling sweep tx when available.
 */
export async function reconcileSiblingDepositsAtEmptyAddresses(): Promise<number> {
  const client = getBscPublicClient();

  const open = await prisma.cryptoDeposit.findMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      toAddress: { not: null },
      NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
    },
    select: {
      id: true,
      toAddress: true,
      sweepTxHash: true,
      gasFundingTxHash: true,
      sweptAt: true,
    },
  });

  if (open.length === 0) return 0;

  const byAddress = new Map<string, typeof open>();
  for (const row of open) {
    const key = row.toAddress!.toLowerCase();
    const list = byAddress.get(key) ?? [];
    list.push(row);
    byAddress.set(key, list);
  }

  let reconciled = 0;
  const balanceCache = new Map<string, bigint>();
  const referenceCache = new Map<string, SweepReference | null>();

  for (const [addr, deposits] of byAddress) {
    if (!balanceCache.has(addr)) {
      const { usdt } = await readAddressBalances(client, addr as `0x${string}`);
      balanceCache.set(addr, usdt);
    }
    if ((balanceCache.get(addr) ?? 0n) > 0n) continue;

    if (!referenceCache.has(addr)) {
      referenceCache.set(addr, await findSweepReference(addr));
    }
    const reference = referenceCache.get(addr);

    for (const deposit of deposits) {
      await prisma.cryptoDeposit.update({
        where: { id: deposit.id },
        data: {
          sweepStatus: SWEEP_STATUS.COMPLETED,
          sweepError: null,
          sweepTxHash: deposit.sweepTxHash ?? reference?.sweepTxHash ?? null,
          gasFundingTxHash: deposit.gasFundingTxHash ?? reference?.gasFundingTxHash ?? null,
          sweptAt: deposit.sweptAt ?? reference?.sweptAt ?? new Date(),
        },
      });
      reconciled += 1;

      logSweepEvent(
        reference?.sweepTxHash
          ? "Sibling deposit auto-completed (address empty)"
          : "Deposit auto-completed — address empty, no USDT on-chain",
        {
          depositId: deposit.id,
          step: reference?.sweepTxHash ? "reconcile_sibling" : "reconcile_empty",
          depositAddress: addr,
          sweepTxHash: reference?.sweepTxHash ?? undefined,
        }
      );
    }
  }

  if (reconciled > 0) {
    logSweepEvent("Reconcile finished", {
      depositId: "—",
      step: "reconcile_done",
      amount: String(reconciled),
    });
  }

  return reconciled;
}

/** Skip addresses that already have a completed sweep and no USDT on-chain. */
export async function isAddressAlreadyFullySwept(toAddress: string): Promise<boolean> {
  const client = getBscPublicClient();
  const addr = toAddress.toLowerCase() as `0x${string}`;
  const { usdt } = await readAddressBalances(client, addr);
  if (usdt > 0n) return false;

  const done = await prisma.cryptoDeposit.findFirst({
    where: {
      toAddress: depositAddressEquals(addr),
      sweepStatus: SWEEP_STATUS.COMPLETED,
      sweepTxHash: { not: null },
      status: "confirmed",
    },
    select: { id: true },
  });

  return Boolean(done);
}
