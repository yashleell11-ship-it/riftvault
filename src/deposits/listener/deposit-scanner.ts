import type { Log } from "viem";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { ERC20_TRANSFER_EVENT, getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { addressesEqual } from "@/payments/blockchain/amounts";
import {
  getListenerCursor,
  setListenerCursor,
} from "@/payments/database/payment-repository";
import { DEPOSIT_LISTENER_STATE_ID } from "@/deposits/blockchain/config";
import { getAddressOwnerMap } from "@/deposits/services/provision-addresses";
import {
  rawUsdtToFloat,
  updateDepositConfirmations,
} from "@/deposits/services/confirm-deposit";
import { uniqueDepositAddressesEnabled } from "@/lib/env";

type ScannedTransfer = {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
};

function decodeTransferLog(log: Log): ScannedTransfer | null {
  if (!log.topics[1] || !log.topics[2] || log.data === undefined) return null;
  return {
    txHash: log.transactionHash!.toLowerCase(),
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    fromAddress: `0x${log.topics[1].slice(-40)}`.toLowerCase(),
    toAddress: `0x${log.topics[2].slice(-40)}`.toLowerCase(),
    amountRaw: BigInt(log.data).toString(),
  };
}

/** Scan BSC USDT transfers to unique user deposit addresses. */
export async function scanUserDepositTransfers(options?: { maxBlocks?: number }) {
  if (!uniqueDepositAddressesEnabled()) {
    return { scanned: 0, matched: 0 };
  }

  const addressMap = await getAddressOwnerMap();
  if (addressMap.size === 0) {
    return { scanned: 0, matched: 0 };
  }

  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();
  const token = getUsdtTokenAddress();

  const cursor = await getListenerCursor(prisma, DEPOSIT_LISTENER_STATE_ID);
  const lookback = BigInt(process.env.PAYMENT_LISTENER_LOOKBACK_BLOCKS ?? 2_000);
  const fromBlock =
    cursor?.lastBlock != null
      ? cursor.lastBlock + 1n
      : latestBlock > lookback
        ? latestBlock - lookback
        : 0n;

  const maxBlocks = BigInt(options?.maxBlocks ?? 500);
  const toBlock =
    fromBlock + maxBlocks > latestBlock ? latestBlock : fromBlock + maxBlocks;

  if (fromBlock > toBlock) {
    await updateDepositConfirmations();
    return { scanned: 0, matched: 0 };
  }

  const logs = await client.getLogs({
    address: token,
    event: ERC20_TRANSFER_EVENT,
    fromBlock,
    toBlock,
  });

  let matched = 0;
  const receiving = getReceivingWallet()?.toLowerCase();

  for (const log of logs) {
    const transfer = decodeTransferLog(log);
    if (!transfer) continue;

    const owner = addressMap.get(transfer.toAddress);
    if (!owner) continue;

    // Skip checkout receiving wallet (handled by payment matcher).
    if (receiving && addressesEqual(transfer.toAddress, receiving)) continue;

    const existing = await prisma.cryptoDeposit.findUnique({
      where: {
        txHash_logIndex: {
          txHash: transfer.txHash,
          logIndex: transfer.logIndex,
        },
      },
    });
    if (existing) continue;

    const amount = rawUsdtToFloat(transfer.amountRaw);

    await prisma.cryptoDeposit.create({
      data: {
        userId: owner.userId,
        chainKey: owner.chainKey,
        asset: owner.asset,
        amount,
        amountRaw: transfer.amountRaw,
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
        blockNumber: Number(transfer.blockNumber),
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        status: "detecting",
        confirmations: 1,
        autoDetected: true,
      },
    });

    matched += 1;
  }

  await setListenerCursor(prisma, DEPOSIT_LISTENER_STATE_ID, toBlock);
  await updateDepositConfirmations();

  return {
    scanned: Number(toBlock - fromBlock + 1n),
    matched,
  };
}
