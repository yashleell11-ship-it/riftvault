import { parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { readAddressBalances } from "@/deposits/sweeper/address-sweep";
import {
  getMinSweepUsdt,
  SWEEP_STATUS,
} from "@/deposits/sweeper/config";

export function depositAddressEquals(address: string) {
  return { equals: address.toLowerCase(), mode: "insensitive" as const };
}

export function sweepQueueWhere() {
  return {
    status: "confirmed" as const,
    walletTxId: { not: null },
    NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
  };
}

export async function countDepositsToSweep(): Promise<number> {
  const ids = await findDepositsToSweep(500);
  return ids.length;
}

type QueueRow = {
  id: string;
  toAddress: string | null;
  sweepTxHash: string | null;
  amount: number;
  sweepStatus: string | null;
};

/**
 * Build sweep queue from on-chain USDT per address (source of truth).
 * One primary row per funded address; finishable rows (mid-sweep / empty) first.
 */
export async function findDepositsToSweep(limit: number) {
  const rows = await prisma.cryptoDeposit.findMany({
    where: sweepQueueWhere(),
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      toAddress: true,
      sweepTxHash: true,
      amount: true,
      sweepStatus: true,
    },
  });

  const hdRows = await prisma.userDepositAddress.findMany({
    select: { address: true },
  });

  const client = getBscPublicClient();
  const minWei = parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);
  const balanceCache = new Map<string, bigint>();
  const rowsByAddress = new Map<string, QueueRow[]>();

  for (const row of rows) {
    if (!row.toAddress) continue;
    const key = row.toAddress.toLowerCase();
    const list = rowsByAddress.get(key) ?? [];
    list.push(row);
    rowsByAddress.set(key, list);
  }

  for (const { address } of hdRows) {
    const key = address.toLowerCase();
    if (!rowsByAddress.has(key)) {
      rowsByAddress.set(key, []);
    }
  }

  async function usdtAt(address: string): Promise<bigint> {
    const key = address.toLowerCase();
    if (!balanceCache.has(key)) {
      const { usdt } = await readAddressBalances(client, key as `0x${string}`);
      balanceCache.set(key, usdt);
    }
    return balanceCache.get(key)!;
  }

  const finishable: QueueRow[] = [];
  const primaryByAddress = new Map<string, QueueRow>();

  for (const [addr, addrRows] of rowsByAddress) {
    const usdt = await usdtAt(addr);

    if (addrRows.length === 0 && usdt >= minWei) {
      const linked = await prisma.cryptoDeposit.findFirst({
        where: {
          toAddress: depositAddressEquals(addr),
          status: "confirmed",
          walletTxId: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          toAddress: true,
          sweepTxHash: true,
          amount: true,
          sweepStatus: true,
        },
      });
      if (linked && linked.sweepStatus !== SWEEP_STATUS.COMPLETED) {
        addrRows.push(linked);
      }
    }

    for (const row of addrRows) {
      if (row.sweepTxHash) {
        finishable.push(row);
        continue;
      }
    }

    if (usdt === 0n) {
      for (const row of addrRows) {
        if (!row.sweepTxHash) finishable.push(row);
      }
      continue;
    }

    if (usdt < minWei) {
      const hasMeaningful = addrRows.some((r) => r.amount >= getMinSweepUsdt());
      if (!hasMeaningful) continue;
    }

    const primary =
      addrRows.find((r) => !r.sweepTxHash) ??
      addrRows.find((r) => r.sweepStatus !== SWEEP_STATUS.COMPLETED) ??
      addrRows[0];
    if (primary && !primary.sweepTxHash) {
      primaryByAddress.set(addr, primary);
    }
  }

  const needsSweep = [...primaryByAddress.values()];
  const ordered = [...finishable, ...needsSweep];
  const seen = new Set<string>();
  const deduped: QueueRow[] = [];

  for (const row of ordered) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push(row);
  }

  return deduped.slice(0, limit).map(({ id, sweepStatus }) => ({ id, sweepStatus }));
}

/** On-chain USDT balance per deposit address (for admin display). */
export async function readOnChainUsdtByAddress(
  addresses: string[]
): Promise<Map<string, string>> {
  const client = getBscPublicClient();
  const out = new Map<string, string>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];

  await Promise.all(
    unique.map(async (addr) => {
      try {
        const { usdt } = await readAddressBalances(client, addr as `0x${string}`);
        out.set(addr, formatUsdt(usdt));
      } catch {
        out.set(addr, "?");
      }
    })
  );

  return out;
}

function formatUsdt(wei: bigint): string {
  const base = 10n ** BigInt(USDT_DECIMALS);
  const whole = wei / base;
  const frac = wei % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
