import type { PublicClient } from "viem";
import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { readUsdtBalance } from "@/deposits/blockchain/erc20";
import {
  estimateUsdtTransferGas,
  gasFundingShortfall,
  type GasEstimate,
} from "@/deposits/blockchain/gas";
import { sendSignedTransaction } from "@/deposits/blockchain/send-signed";
import type { LocalAccount } from "viem/accounts";
import {
  getGasFundingMaxAttempts,
  getMaxGasFundingTxs,
  getSweepTxConfirmations,
} from "@/deposits/sweeper/config";
import { depositAddressEquals } from "@/deposits/sweeper/queue";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export type AddressBalances = {
  bnb: bigint;
  usdt: bigint;
};

export async function readAddressBalances(
  client: PublicClient,
  address: `0x${string}`
): Promise<AddressBalances> {
  const [bnb, usdt] = await Promise.all([
    client.getBalance({ address }),
    readUsdtBalance(client, address),
  ]);
  return { bnb, usdt };
}

/** Prior sweep tx at the same deposit address (any sibling or completed row). */
export async function findPriorSweepTxAtAddress(
  depositAddress: string,
  excludeDepositId: string
): Promise<`0x${string}` | null> {
  const prior = await prisma.cryptoDeposit.findFirst({
    where: {
      toAddress: depositAddressEquals(depositAddress),
      id: { not: excludeDepositId },
      sweepTxHash: { not: null },
      status: "confirmed",
    },
    orderBy: [{ sweptAt: "desc" }, { updatedAt: "desc" }],
    select: { sweepTxHash: true },
  });
  return (prior?.sweepTxHash as `0x${string}` | null) ?? null;
}

type FundContext = Parameters<typeof logSweepEvent>[1];

/** Send BNB from treasury in as many txs as needed until balance >= target. */
export async function fundBnbUntilTarget(options: {
  publicClient: PublicClient;
  treasury: LocalAccount;
  depositAddress: `0x${string}`;
  targetWei: bigint;
  ctx: FundContext;
  stepPrefix?: string;
  waitForConfirmations: (txHash: `0x${string}`, required: number) => Promise<unknown>;
}): Promise<{ firstFundingTxHash: `0x${string}` | null; fundingTxCount: number }> {
  const maxAttempts = getMaxGasFundingTxs();
  let firstFundingTxHash: `0x${string}` | null = null;
  let fundingTxCount = 0;
  const stepPrefix = options.stepPrefix ?? "gas_funding";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const balance = await options.publicClient.getBalance({ address: options.depositAddress });
    const shortfall = gasFundingShortfall(balance, options.targetWei);

    logSweepEvent("Address BNB balance check", {
      ...options.ctx,
      step: `${stepPrefix}_balance_check`,
      amount: formatUnits(balance, 18),
      gasSent: formatUnits(options.targetWei, 18),
    });

    if (shortfall === 0n) {
      return { firstFundingTxHash, fundingTxCount };
    }

    logSweepEvent("Sending BNB top-up", {
      ...options.ctx,
      step: `${stepPrefix}_tx_${attempt}`,
      gasSent: formatUnits(shortfall, 18),
      amount: String(attempt),
    });

    const fundHash = await sendSignedTransaction(options.treasury, {
      to: options.depositAddress,
      value: shortfall,
    });

    if (!firstFundingTxHash) firstFundingTxHash = fundHash;
    fundingTxCount += 1;

    await options.waitForConfirmations(fundHash, getSweepTxConfirmations());
  }

  const finalBalance = await options.publicClient.getBalance({ address: options.depositAddress });
  if (finalBalance < options.targetWei) {
    throw new Error(
      `Insufficient BNB after ${maxAttempts} funding txs: balance ${finalBalance} wei, need ${options.targetWei} wei`
    );
  }

  return { firstFundingTxHash, fundingTxCount };
}

export type EnsureGasFundedResult = {
  /** Pinned gas plan to use VERBATIM when signing the USDT sweep tx. */
  plan: GasEstimate;
  balances: AddressBalances;
  firstFundingTxHash: `0x${string}` | null;
  fundingTxCount: number;
};

/**
 * Guarantee a deposit address holds enough BNB to sweep `usdtAmount`, and
 * return the EXACT pinned gas plan the caller must sign the sweep with.
 *
 * Each attempt re-reads balance and re-plans gas (so a mid-flight gas-price
 * rise is absorbed), funds the shortfall, and waits for confirmation. The
 * sweep tx is later signed with `plan.gasLimit`/`plan.gasPrice`, so its cost
 * is bounded by `plan.fundingTarget` which we have just funded — underfunding
 * is impossible. Throws only if still short after `maxAttempts` top-ups.
 */
export async function ensureGasFunded(options: {
  publicClient: PublicClient;
  treasury: LocalAccount;
  depositAddress: `0x${string}`;
  receiving: `0x${string}`;
  usdtAmount: bigint;
  ctx: FundContext;
  waitForConfirmations: (txHash: `0x${string}`, required: number) => Promise<unknown>;
  onFirstFundingTx?: (txHash: `0x${string}`) => Promise<void>;
}): Promise<EnsureGasFundedResult> {
  const maxAttempts = getGasFundingMaxAttempts();
  let firstFundingTxHash: `0x${string}` | null = null;
  let fundingTxCount = 0;

  const planAndBalance = async (): Promise<{ plan: GasEstimate; balance: bigint }> => {
    const [balance, plan] = await Promise.all([
      options.publicClient.getBalance({ address: options.depositAddress }),
      estimateUsdtTransferGas(
        options.publicClient,
        options.depositAddress,
        options.receiving,
        options.usdtAmount
      ),
    ]);
    return { plan, balance };
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { plan, balance } = await planAndBalance();
    const shortfall = gasFundingShortfall(balance, plan.fundingTarget);

    logSweepEvent("Gas funding balance check", {
      ...options.ctx,
      step: `gas_fund_check_${attempt}`,
      gasSent: formatUnits(balance, 18),
      amount: formatUnits(plan.fundingTarget, 18),
    });

    if (shortfall === 0n) {
      const usdt = await readUsdtBalance(options.publicClient, options.depositAddress);
      return {
        plan,
        balances: { bnb: balance, usdt },
        firstFundingTxHash,
        fundingTxCount,
      };
    }

    logSweepEvent("Funding gas shortfall", {
      ...options.ctx,
      step: `gas_fund_tx_${attempt}`,
      gasSent: formatUnits(shortfall, 18),
      amount: String(attempt),
    });

    const fundHash = await sendSignedTransaction(options.treasury, {
      to: options.depositAddress,
      value: shortfall,
    });
    if (!firstFundingTxHash) {
      firstFundingTxHash = fundHash;
      await options.onFirstFundingTx?.(fundHash);
    }
    fundingTxCount += 1;
    await options.waitForConfirmations(fundHash, getSweepTxConfirmations());
  }

  // Final verification — never return a plan the wallet cannot afford.
  const { plan, balance } = await planAndBalance();
  if (balance < plan.fundingTarget) {
    throw new Error(
      `Gas funding failed after ${maxAttempts} attempts: balance ${balance} wei < target ${plan.fundingTarget} wei`
    );
  }
  const usdt = await readUsdtBalance(options.publicClient, options.depositAddress);
  return { plan, balances: { bnb: balance, usdt }, firstFundingTxHash, fundingTxCount };
}
