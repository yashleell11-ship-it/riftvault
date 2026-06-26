import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { decodeTransferLog } from "@/payments/blockchain/log-scanner";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { depositAddressEquals } from "@/deposits/sweeper/queue";
import { findDerivationIndexForAddress } from "@/deposits/sweeper/derive-index";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export type LegacyBackfillResult = {
  sweepStatusSet: number;
  toAddressSet: number;
  addressesLinked: number;
};

const OPEN_DEPOSIT_WHERE = {
  status: "confirmed" as const,
  walletTxId: { not: null },
  NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
};

function isBlankSweepStatus(status: string | null | undefined): boolean {
  return status == null || status.trim() === "";
}

/** Set sweepStatus=pending on legacy confirmed deposits that never got a sweep row. */
export async function backfillSweepStatusPending(): Promise<number> {
  const legacy = await prisma.cryptoDeposit.findMany({
    where: {
      ...OPEN_DEPOSIT_WHERE,
      OR: [{ sweepStatus: null }, { sweepStatus: "" }],
    },
    select: { id: true },
  });

  if (legacy.length === 0) return 0;

  const updated = await prisma.cryptoDeposit.updateMany({
    where: { id: { in: legacy.map((d) => d.id) } },
    data: {
      sweepStatus: SWEEP_STATUS.PENDING,
      sweepError: null,
    },
  });

  if (updated.count > 0) {
    logSweepEvent("Backfilled sweepStatus=pending for legacy deposits", {
      depositId: "—",
      step: "backfill_sweep_status",
      amount: String(updated.count),
    });
  }

  return updated.count;
}

async function fetchUsdtRecipientFromTx(
  txHash: string,
  logIndex: number | null
): Promise<string | null> {
  try {
    const client = getBscPublicClient();
    const receipt = await client.getTransactionReceipt({
      hash: txHash.toLowerCase() as `0x${string}`,
    });
    if (!receipt) return null;

    const usdt = getUsdtTokenAddress().toLowerCase();
    const receiving = getReceivingWallet()?.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdt) continue;
      const decoded = decodeTransferLog(log);
      if (!decoded) continue;
      if (logIndex != null && decoded.logIndex !== logIndex) continue;
      if (receiving && decoded.toAddress === receiving) continue;
      return decoded.toAddress;
    }
  } catch (error) {
    console.error("[sweeper/backfill] tx receipt read failed:", txHash, error);
  }
  return null;
}

/** Fill missing toAddress from on-chain tx or the user's provisioned HD address. */
export async function backfillDepositToAddresses(): Promise<number> {
  const missing = await prisma.cryptoDeposit.findMany({
    where: {
      ...OPEN_DEPOSIT_WHERE,
      OR: [{ toAddress: null }, { toAddress: "" }],
    },
    select: {
      id: true,
      txHash: true,
      logIndex: true,
      userId: true,
      chainKey: true,
      asset: true,
    },
    take: 100,
  });

  let set = 0;

  for (const deposit of missing) {
    let toAddress: string | null = null;

    if (deposit.txHash) {
      toAddress = await fetchUsdtRecipientFromTx(deposit.txHash, deposit.logIndex);
    }

    if (!toAddress) {
      const userAddr = await prisma.userDepositAddress.findFirst({
        where: {
          userId: deposit.userId,
          chainKey: deposit.chainKey,
          asset: deposit.asset,
        },
        select: { address: true },
      });
      toAddress = userAddr?.address.toLowerCase() ?? null;
    }

    if (!toAddress) continue;

    await prisma.cryptoDeposit.update({
      where: { id: deposit.id },
      data: { toAddress: toAddress.toLowerCase() },
    });
    set += 1;

    logSweepEvent("Backfilled deposit toAddress", {
      depositId: deposit.id,
      step: "backfill_to_address",
      depositAddress: toAddress,
    });
  }

  return set;
}

/** Ensure UserDepositAddress exists for deposit HD addresses (legacy provisioning gaps). */
export async function backfillUserDepositAddresses(): Promise<number> {
  const deposits = await prisma.cryptoDeposit.findMany({
    where: {
      ...OPEN_DEPOSIT_WHERE,
      toAddress: { not: null },
    },
    select: {
      id: true,
      userId: true,
      chainKey: true,
      asset: true,
      toAddress: true,
    },
    take: 200,
  });

  let linked = 0;

  for (const deposit of deposits) {
    const addr = deposit.toAddress!.toLowerCase();

    const existing = await prisma.userDepositAddress.findFirst({
      where: { address: depositAddressEquals(addr) },
      select: { id: true },
    });
    if (existing) continue;

    const derivationIndex = await findDerivationIndexForAddress(addr);
    if (derivationIndex == null) continue;

    const userRow = await prisma.userDepositAddress.findUnique({
      where: {
        userId_chainKey_asset: {
          userId: deposit.userId,
          chainKey: deposit.chainKey,
          asset: deposit.asset,
        },
      },
      select: { address: true },
    });

    if (userRow) {
      if (userRow.address.toLowerCase() === addr) continue;
      logSweepEvent("User has different deposit address — using scanned derivation index", {
        depositId: deposit.id,
        step: "backfill_address_mismatch",
        depositAddress: addr,
      });
      continue;
    }

    try {
      await prisma.userDepositAddress.create({
        data: {
          userId: deposit.userId,
          chainKey: deposit.chainKey,
          asset: deposit.asset,
          address: addr,
          derivationIndex,
        },
      });
      linked += 1;
      logSweepEvent("Backfilled UserDepositAddress row", {
        depositId: deposit.id,
        step: "backfill_user_address",
        depositAddress: addr,
        amount: String(derivationIndex),
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "P2002") throw error;
    }
  }

  return linked;
}

/** Run all legacy backfill steps before sweep/reconcile. */
export async function backfillLegacyDepositsForSweeper(): Promise<LegacyBackfillResult> {
  const sweepStatusSet = await backfillSweepStatusPending();
  const toAddressSet = await backfillDepositToAddresses();
  const addressesLinked = await backfillUserDepositAddresses();

  return { sweepStatusSet, toAddressSet, addressesLinked };
}

export { isBlankSweepStatus };
