import { formatUnits, parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { estimateUsdtTransferGas } from "@/deposits/blockchain/gas";
import {
  getTreasuryAccount,
  getTreasuryAddressMismatch,
} from "@/deposits/blockchain/wallet-client";
import { fundBnbUntilTarget, readAddressBalances } from "@/deposits/sweeper/address-sweep";
import { waitForConfirmations } from "@/deposits/sweeper/confirmations";
import { getMinSweepUsdt, getBatchFundAddressLimit, SWEEP_STATUS } from "@/deposits/sweeper/config";
import { sweepQueueWhere } from "@/deposits/sweeper/queue";
import { logSweepEvent } from "@/deposits/sweeper/logger";

/** Mark sub-minimum deposits completed without on-chain sweep. */
async function completeBelowMinDeposits() {
  const minUsdt = getMinSweepUsdt();
  const updated = await prisma.cryptoDeposit.updateMany({
    where: {
      status: "confirmed",
      walletTxId: { not: null },
      amount: { lt: minUsdt },
      NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
    },
    data: {
      sweepStatus: SWEEP_STATUS.COMPLETED,
      sweepError: null,
    },
  });
  if (updated.count > 0) {
    logSweepEvent("Auto-completed below-minimum deposits", {
      depositId: "—",
      step: "below_min_auto_complete",
      amount: String(updated.count),
    });
  }
  return updated.count;
}

async function listPendingDepositIds(limit: number) {
  return prisma.cryptoDeposit.findMany({
    where: sweepQueueWhere(),
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
}

export { completeBelowMinDeposits };

export async function fundGasForAllPendingAddresses(depositLimit?: number) {
  const receiving = getReceivingWallet();
  const treasury = getTreasuryAccount();
  const mismatch = getTreasuryAddressMismatch();

  if (!receiving || !treasury) {
    return {
      ok: false,
      error: mismatch ?? "Treasury not configured",
      addressesChecked: 0,
      addressesFunded: 0,
      fundingTxCount: 0,
    };
  }

  const fundLimit = depositLimit ?? getBatchFundAddressLimit();
  const pending = await listPendingDepositIds(fundLimit);
  const publicClient = getBscPublicClient();
  const byAddress = new Map<
    string,
    { address: `0x${string}`; depositIds: string[] }
  >();

  for (const { id } of pending) {
    const row = await prisma.cryptoDeposit.findUnique({
      where: { id },
      select: { toAddress: true },
    });
    if (!row?.toAddress) continue;
    const key = row.toAddress.toLowerCase();
    const entry = byAddress.get(key) ?? { address: key as `0x${string}`, depositIds: [] };
    entry.depositIds.push(id);
    byAddress.set(key, entry);
  }

  let addressesFunded = 0;
  let fundingTxCount = 0;

  for (const { address, depositIds } of byAddress.values()) {
    const balances = await readAddressBalances(publicClient, address);
    if (balances.usdt === 0n) continue;

    const minUsdtWei = parseUnits(String(getMinSweepUsdt()), USDT_DECIMALS);
    if (balances.usdt < minUsdtWei) {
      logSweepEvent("Batch fund skipped — USDT below minimum", {
        depositId: depositIds[0] ?? "—",
        step: "batch_fund_below_min",
        depositAddress: address,
        amount: formatUnits(balances.usdt, 18),
      });
      continue;
    }

    const gasEstimate = await estimateUsdtTransferGas(
      publicClient,
      address,
      receiving,
      balances.usdt
    );

    if (balances.bnb >= gasEstimate.fundingTarget) {
      logSweepEvent("Address already has enough BNB for sweep", {
        depositId: depositIds[0] ?? "—",
        step: "batch_fund_skip",
        depositAddress: address,
        gasSent: formatUnits(balances.bnb, 18),
      });
      continue;
    }

    logSweepEvent("Batch funding gas for address", {
      depositId: depositIds[0] ?? "—",
      step: "batch_fund_start",
      depositAddress: address,
      amount: formatUnits(balances.usdt, 18),
      gasSent: formatUnits(gasEstimate.fundingTarget, 18),
    });

    const funded = await fundBnbUntilTarget({
      publicClient,
      treasury,
      depositAddress: address,
      targetWei: gasEstimate.fundingTarget,
      ctx: {
        depositId: depositIds[0] ?? "—",
        depositAddress: address,
        step: "batch_fund",
      },
      stepPrefix: "batch_gas",
      waitForConfirmations: (txHash, required) =>
        waitForConfirmations(publicClient, txHash, required),
    });

    if (funded.firstFundingTxHash) {
      await prisma.cryptoDeposit.updateMany({
        where: {
          id: { in: depositIds },
          gasFundingTxHash: null,
        },
        data: {
          gasFundingTxHash: funded.firstFundingTxHash,
          sweepStatus: SWEEP_STATUS.FUNDING_GAS,
        },
      });
      addressesFunded += 1;
      fundingTxCount += funded.fundingTxCount;
    }
  }

  logSweepEvent("Batch gas funding finished", {
    depositId: "—",
    step: "batch_fund_done",
    amount: String(addressesFunded),
  });

  return {
    ok: true,
    addressesChecked: byAddress.size,
    addressesFunded,
    fundingTxCount,
  };
}
