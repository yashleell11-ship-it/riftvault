import type { Log } from "viem";
import { getBscPublicClient } from "@/payments/blockchain/client";
import {
  getReceivingWallet,
  getUsdtContractAddress,
  PAYMENT_LISTENER_STATE_ID,
} from "@/payments/blockchain/config";
import { ERC20_TRANSFER_EVENT, getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { addressesEqual } from "@/payments/blockchain/amounts";
import {
  getListenerCursor,
  isTransferProcessed,
  setListenerCursor,
} from "@/payments/database/payment-repository";
import { processDetectedTransfer } from "@/payments/listener/payment-matcher";
import { prisma } from "@/lib/db";

export type ScannedTransfer = {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
};

function decodeTransferLog(log: Log): ScannedTransfer | null {
  if (!log.topics[1] || !log.topics[2] || log.data === undefined) return null;

  const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
  const to = `0x${log.topics[2].slice(-40)}`.toLowerCase();
  const value = BigInt(log.data);

  return {
    txHash: log.transactionHash!.toLowerCase(),
    logIndex: log.logIndex!,
    blockNumber: log.blockNumber!,
    fromAddress: from,
    toAddress: to,
    amountRaw: value.toString(),
  };
}

export async function scanUsdtTransfers(options?: {
  maxBlocks?: number;
  paymentOrderId?: string;
}): Promise<{ scanned: number; matched: number; latestBlock: bigint }> {
  const receiving = getReceivingWallet();
  if (!receiving) {
    console.warn("[payment-listener] RECEIVING_WALLET not configured");
    return { scanned: 0, matched: 0, latestBlock: 0n };
  }

  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();
  const token = getUsdtTokenAddress();

  const cursor = await getListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID);
  const lookback = BigInt(process.env.PAYMENT_LISTENER_LOOKBACK_BLOCKS ?? 2_000);
  let fromBlock =
    cursor?.lastBlock != null
      ? cursor.lastBlock + 1n
      : latestBlock > lookback
        ? latestBlock - lookback
        : 0n;

  const maxBlocks = BigInt(options?.maxBlocks ?? 500);
  if (fromBlock + maxBlocks < latestBlock) {
    // Process in chunks to avoid RPC limits
  }
  const toBlock =
    fromBlock + maxBlocks > latestBlock ? latestBlock : fromBlock + maxBlocks;

  if (fromBlock > toBlock) {
    return { scanned: 0, matched: 0, latestBlock };
  }

  const logs = await client.getLogs({
    address: token,
    event: ERC20_TRANSFER_EVENT,
    fromBlock,
    toBlock,
    args: {
      to: receiving,
    },
  });

  let matched = 0;

  for (const log of logs) {
    const transfer = decodeTransferLog(log);
    if (!transfer) continue;
    if (!addressesEqual(transfer.toAddress, receiving)) continue;

    const processed = await isTransferProcessed(
      prisma,
      transfer.txHash,
      transfer.logIndex
    );
    if (processed) continue;

    const result = await processDetectedTransfer(transfer, options?.paymentOrderId);
    if (result.matched) matched += 1;
  }

  await setListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID, toBlock);

  return {
    scanned: Number(toBlock - fromBlock + 1n),
    matched,
    latestBlock,
  };
}

export async function updatePaymentConfirmations(paymentOrderId?: string) {
  const receiving = getReceivingWallet();
  if (!receiving) return;

  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();

  const orders = await prisma.usdtPaymentOrder.findMany({
    where: {
      status: { in: ["detecting", "confirming"] },
      txHash: { not: null },
      ...(paymentOrderId ? { id: paymentOrderId } : {}),
    },
  });

  for (const order of orders) {
    if (!order.txHash || order.blockNumber == null) continue;

    const confirmations = Number(latestBlock - BigInt(order.blockNumber) + 1n);
    const nextStatus =
      confirmations >= order.requiredConfirmations
        ? "confirming"
        : confirmations > 0
          ? "confirming"
          : "detecting";

    await prisma.usdtPaymentOrder.update({
      where: { id: order.id },
      data: { confirmations, status: nextStatus },
    });

    await prisma.usdtPayment.updateMany({
      where: { paymentOrderId: order.id },
      data: { confirmations },
    });

    if (confirmations >= order.requiredConfirmations) {
      const { fulfillPaymentOrder } = await import("@/payments/services/fulfill-payment-order");
      await fulfillPaymentOrder(order.id);
    }
  }
}
