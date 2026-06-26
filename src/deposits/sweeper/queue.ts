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
    OR: [
      { sweepStatus: null },
      { sweepStatus: SWEEP_STATUS.PENDING },
      { sweepStatus: SWEEP_STATUS.FAILED },
      { sweepStatus: SWEEP_STATUS.FUNDING_GAS },
      { sweepStatus: SWEEP_STATUS.SWEEPING },
      { sweepStatus: SWEEP_STATUS.SWEPT },
      { sweepStatus: SWEEP_STATUS.REFUNDING },
    ],
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
 * Build sweep queue from DB + on-chain USDT (not DB amount alone).
 * One primary row per address that still holds USDT; finishable rows first.
 */
export async function findDepositsToSweep(limit: number) {
  const rows = await prisma.cryptoDeposit.findMany({
    where: sweepQueueWhere(),
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      toAddress: true,
      sweepTxHash: true,
      amount: true,
      sweepStatus: true,
    },
  });

  if (rows.length === 0) return [];

  const client = getBscPublicClient();
  const minWei = parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);
  const balanceCache = new Map<string, bigint>();

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

  for (const row of rows) {
    if (!row.toAddress) continue;

    if (row.sweepTxHash) {
      finishable.push(row);
      continue;
    }

    const usdt = await usdtAt(row.toAddress);

    if (usdt === 0n) {
      finishable.push(row);
      continue;
    }

    if (usdt < minWei && row.amount < getMinSweepUsdt()) {
      continue;
    }

    const addr = row.toAddress.toLowerCase();
    if (!primaryByAddress.has(addr)) {
      primaryByAddress.set(addr, row);
    }
  }

  const needsSweep = [...primaryByAddress.values()];
  const ordered = [...finishable, ...needsSweep];

  return ordered.slice(0, limit).map(({ id, sweepStatus }) => ({ id, sweepStatus }));
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
