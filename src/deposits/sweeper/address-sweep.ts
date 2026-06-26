import type { PublicClient } from "viem";
import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { readUsdtBalance } from "@/deposits/blockchain/erc20";
import { gasFundingShortfall } from "@/deposits/blockchain/gas";
import { sendSignedTransaction } from "@/deposits/blockchain/send-signed";
import type { LocalAccount } from "viem/accounts";
import { getMaxGasFundingTxs, getSweepTxConfirmations } from "@/deposits/sweeper/config";
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
