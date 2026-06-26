import { parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { readAddressBalances } from "@/deposits/sweeper/address-sweep";
import { getMinSweepUsdt, SWEEP_STATUS } from "@/deposits/sweeper/config";
import { depositAddressEquals } from "@/deposits/sweeper/queue";
import { logSweepEvent } from "@/deposits/sweeper/logger";

/**
 * Rows marked completed without a sweep tx while USDT still sits on the deposit
 * address — usually from bad reconcile. Reset so the sweeper picks them up again.
 */
export async function resetMiscompletedDepositsWithOnChainUsdt(): Promise<number> {
  const client = getBscPublicClient();
  const minWei = parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);

  const wronglyCompleted = await prisma.cryptoDeposit.findMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      sweepStatus: SWEEP_STATUS.COMPLETED,
      sweepTxHash: null,
      toAddress: { not: null },
    },
    select: { id: true, toAddress: true },
    take: 200,
  });

  let reset = 0;
  const checked = new Map<string, bigint>();

  for (const row of wronglyCompleted) {
    const addr = row.toAddress!.toLowerCase();
    if (!checked.has(addr)) {
      const { usdt } = await readAddressBalances(client, addr as `0x${string}`);
      checked.set(addr, usdt);
    }
    if ((checked.get(addr) ?? 0n) < minWei) continue;

    await prisma.cryptoDeposit.update({
      where: { id: row.id },
      data: {
        sweepStatus: SWEEP_STATUS.PENDING,
        sweepError: null,
        sweptAt: null,
      },
    });
    reset += 1;
    logSweepEvent("Reset miscompleted deposit — USDT still on-chain", {
      depositId: row.id,
      step: "reset_miscompleted",
      depositAddress: addr,
    });
  }

  return reset;
}

/** Re-open non-completed rows at addresses that still hold sweepable USDT. */
export async function ensureOpenDepositsForFundedAddresses(): Promise<number> {
  const client = getBscPublicClient();
  const minWei = parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);

  const addresses = await prisma.userDepositAddress.findMany({
    select: { address: true },
  });

  const unique = [...new Set(addresses.map((a) => a.address.toLowerCase()))];
  let reopened = 0;

  for (const addr of unique) {
    const { usdt } = await readAddressBalances(client, addr as `0x${string}`);
    if (usdt < minWei) continue;

    const open = await prisma.cryptoDeposit.count({
      where: {
        toAddress: depositAddressEquals(addr),
        status: "confirmed",
        walletTxId: { not: null },
        NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
      },
    });
    if (open > 0) continue;

    const any = await prisma.cryptoDeposit.findFirst({
      where: {
        toAddress: depositAddressEquals(addr),
        status: "confirmed",
        walletTxId: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!any) continue;

    await prisma.cryptoDeposit.update({
      where: { id: any.id },
      data: {
        sweepStatus: SWEEP_STATUS.PENDING,
        sweepError: null,
        sweptAt: null,
      },
    });
    reopened += 1;
    logSweepEvent("Re-opened deposit for funded address", {
      depositId: any.id,
      step: "reopen_funded_address",
      depositAddress: addr,
    });
  }

  return reopened;
}
