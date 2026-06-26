import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { readAddressBalances } from "@/deposits/sweeper/address-sweep";
import { depositAddressEquals } from "@/deposits/sweeper/queue";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { logSweepEvent } from "@/deposits/sweeper/logger";

/**
 * When an HD address has no USDT left (already swept), mark every sibling
 * deposit row at that address completed — no new on-chain txs.
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

  for (const [addr, deposits] of byAddress) {
    const { usdt } = await readAddressBalances(client, addr as `0x${string}`);
    if (usdt > 0n) continue;

    const reference = await prisma.cryptoDeposit.findFirst({
      where: {
        toAddress: depositAddressEquals(addr),
        status: "confirmed",
        OR: [{ sweepTxHash: { not: null } }, { sweepStatus: SWEEP_STATUS.COMPLETED }],
      },
      orderBy: { sweptAt: "desc" },
      select: {
        sweepTxHash: true,
        gasFundingTxHash: true,
        sweptAt: true,
        sweepStatus: true,
      },
    });

    if (!reference?.sweepTxHash && reference?.sweepStatus !== SWEEP_STATUS.COMPLETED) {
      for (const deposit of deposits) {
        await prisma.cryptoDeposit.update({
          where: { id: deposit.id },
          data: {
            sweepStatus: SWEEP_STATUS.COMPLETED,
            sweepError: null,
            sweptAt: deposit.sweptAt ?? new Date(),
          },
        });
        reconciled += 1;
        logSweepEvent("Deposit auto-completed — address empty, no sweep tx", {
          depositId: deposit.id,
          step: "reconcile_empty_no_tx",
          depositAddress: addr,
        });
      }
      continue;
    }

    for (const deposit of deposits) {
      await prisma.cryptoDeposit.update({
        where: { id: deposit.id },
        data: {
          sweepStatus: SWEEP_STATUS.COMPLETED,
          sweepError: null,
          sweepTxHash: deposit.sweepTxHash ?? reference?.sweepTxHash,
          gasFundingTxHash: deposit.gasFundingTxHash ?? reference?.gasFundingTxHash,
          sweptAt: deposit.sweptAt ?? reference?.sweptAt ?? new Date(),
        },
      });
      reconciled += 1;

      logSweepEvent("Sibling deposit auto-completed (address empty)", {
        depositId: deposit.id,
        step: "reconcile_sibling",
        depositAddress: addr,
        sweepTxHash: reference?.sweepTxHash ?? undefined,
      });
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
