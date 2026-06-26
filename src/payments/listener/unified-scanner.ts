import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import {
  getReceivingWallet,
  PAYMENT_LISTENER_STATE_ID,
} from "@/payments/blockchain/config";
import { addressesEqual } from "@/payments/blockchain/amounts";
import {
  decodeTransferLog,
  fetchUsdtTransferLogs,
  getLogChunkBlockSize,
} from "@/payments/blockchain/log-scanner";
import {
  getListenerCursor,
  isTransferProcessed,
  setListenerCursor,
} from "@/payments/database/payment-repository";
import { processDetectedTransfer } from "@/payments/listener/payment-matcher";
import type { ScannedTransfer } from "@/payments/listener/transfer-scanner";
import { recordDepositTransfer } from "@/deposits/listener/record-deposit";
import { getAddressOwnerMap } from "@/deposits/services/provision-addresses";
import { getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";
import { uniqueDepositAddressesEnabled } from "@/lib/env";

export type UnifiedScanOptions = {
  /** Explicit range — used for admin rescans (does not read cursor for bounds). */
  fromBlock?: bigint;
  toBlock?: bigint;
  /** Blocks to scan when using cursor (default from env / 12). */
  maxBlocks?: number;
  /** When false, cursor is not updated (historical rescan). Default true for listener ticks. */
  advanceCursor?: boolean;
  paymentOrderId?: string;
  /** Limit deposit address set (wallet page poll). Checkout receiving wallet is always included when configured. */
  onlyDepositAddresses?: `0x${string}`[];
};

export type UnifiedScanResult = {
  scanned: number;
  matched: number;
  depositMatched: number;
  latestBlock: bigint;
  fromBlock: bigint;
  toBlock: bigint;
};

function getDefaultMaxBlocks(): bigint {
  const n = Number(process.env.PAYMENT_LISTENER_MAX_BLOCKS ?? 12);
  return BigInt(Number.isFinite(n) && n > 0 ? Math.floor(n) : 12);
}

function getLookback(): bigint {
  const n = Number(process.env.PAYMENT_LISTENER_LOOKBACK_BLOCKS ?? 100);
  return BigInt(Number.isFinite(n) && n > 0 ? Math.floor(n) : 100);
}

async function buildWatchAddresses(
  onlyDepositAddresses?: `0x${string}`[]
): Promise<{
  addresses: `0x${string}`[];
  depositOwners: Map<string, { userId: string; chainKey: string; asset: string }>;
  receiving: `0x${string}` | null;
}> {
  const receiving = getReceivingWallet();
  const depositOwners = new Map<string, { userId: string; chainKey: string; asset: string }>();
  const addressSet = new Set<string>();

  if (receiving) {
    addressSet.add(receiving.toLowerCase());
  }

  if (uniqueDepositAddressesEnabled()) {
    const addressMap = await getAddressOwnerMap();
    const only = onlyDepositAddresses?.map((a) => a.toLowerCase());

    for (const [addr, owner] of addressMap) {
      const lower = addr.toLowerCase();
      if (only && !only.includes(lower)) continue;
      if (receiving && addressesEqual(lower, receiving)) continue;
      addressSet.add(lower);
      depositOwners.set(lower, owner);
    }
  }

  return {
    addresses: [...addressSet] as `0x${string}`[],
    depositOwners,
    receiving,
  };
}

async function processTransfer(
  transfer: ScannedTransfer,
  receiving: `0x${string}` | null,
  depositOwners: Map<string, { userId: string; chainKey: string; asset: string }>,
  paymentOrderId?: string
): Promise<{ checkout: boolean; deposit: boolean }> {
  if (receiving && addressesEqual(transfer.toAddress, receiving)) {
    if (await isTransferProcessed(prisma, transfer.txHash, transfer.logIndex)) {
      return { checkout: false, deposit: false };
    }
    const result = await processDetectedTransfer(transfer, paymentOrderId);
    return { checkout: result.matched, deposit: false };
  }

  const owner = depositOwners.get(transfer.toAddress);
  if (!owner) {
    return { checkout: false, deposit: false };
  }

  const created = await recordDepositTransfer(transfer, owner);
  return { checkout: false, deposit: created };
}

/**
 * Single-cursor USDT transfer scan — checkout (RECEIVING_WALLET) and unique wallet deposits
 * in one pass. Cursor advances only after the full block range is processed.
 */
export async function scanUsdtTransfersUnified(
  options?: UnifiedScanOptions
): Promise<UnifiedScanResult> {
  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();
  const lookback = getLookback();
  const explicitRange = options?.fromBlock !== undefined && options?.toBlock !== undefined;

  let fromBlock: bigint;
  let toBlock: bigint;
  const advanceCursor = options?.advanceCursor ?? !explicitRange;

  if (explicitRange) {
    fromBlock = options!.fromBlock!;
    toBlock = options!.toBlock!;
    if (fromBlock > toBlock) {
      return {
        scanned: 0,
        matched: 0,
        depositMatched: 0,
        latestBlock,
        fromBlock,
        toBlock,
      };
    }
  } else {
    const cursor = await getListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID);
    fromBlock =
      cursor?.lastBlock != null
        ? cursor.lastBlock + 1n
        : latestBlock > lookback
          ? latestBlock - lookback
          : 0n;

    const maxBehind = BigInt(process.env.PAYMENT_LISTENER_MAX_BEHIND_BLOCKS ?? 500);
    if (latestBlock > fromBlock && latestBlock - fromBlock > maxBehind) {
      const jumpTo = latestBlock - lookback;
      console.warn(
        `[payment-listener] cursor ${fromBlock} is ${latestBlock - fromBlock} blocks behind — jumping to ${jumpTo}`
      );
      fromBlock = jumpTo > 0n ? jumpTo : 0n;
      if (advanceCursor) {
        await setListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID, fromBlock - 1n);
      }
    }

    const maxBlocks = BigInt(options?.maxBlocks ?? Number(getDefaultMaxBlocks()));
    toBlock =
      fromBlock + maxBlocks > latestBlock ? latestBlock : fromBlock + maxBlocks;
  }

  if (fromBlock > toBlock) {
    return {
      scanned: 0,
      matched: 0,
      depositMatched: 0,
      latestBlock,
      fromBlock,
      toBlock,
    };
  }

  const { addresses, depositOwners, receiving } = await buildWatchAddresses(
    options?.onlyDepositAddresses
  );

  if (addresses.length === 0) {
    if (advanceCursor) {
      await setListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID, toBlock);
    }
    return {
      scanned: Number(toBlock - fromBlock + 1n),
      matched: 0,
      depositMatched: 0,
      latestBlock,
      fromBlock,
      toBlock,
    };
  }

  let matched = 0;
  let depositMatched = 0;
  let rangeComplete = true;
  const chunkSize = getLogChunkBlockSize();

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;

    try {
      const logs = await fetchUsdtTransferLogs(client, {
        fromBlock: start,
        toBlock: end,
        toAddresses: addresses,
      });

      for (const log of logs) {
        const transfer = decodeTransferLog(log);
        if (!transfer) continue;

        const result = await processTransfer(
          transfer,
          receiving,
          depositOwners,
          options?.paymentOrderId
        );
        if (result.checkout) matched += 1;
        if (result.deposit) depositMatched += 1;
      }
    } catch (error) {
      console.error(
        `[payment-listener] unified scan failed blocks ${start}-${end}:`,
        error
      );
      rangeComplete = false;
      break;
    }
  }

  if (rangeComplete && advanceCursor) {
    await setListenerCursor(prisma, PAYMENT_LISTENER_STATE_ID, toBlock);
  }

  return {
    scanned: Number(toBlock - fromBlock + 1n),
    matched,
    depositMatched,
    latestBlock,
    fromBlock,
    toBlock,
  };
}

/**
 * Rescan a single tx by receipt (works for archive blocks — no eth_getLogs range needed).
 */
export async function rescanUsdtTransactionByHash(txHash: `0x${string}`): Promise<{
  matched: number;
  depositMatched: number;
  blockNumber: bigint;
  latestBlock: bigint;
  transfersProcessed: number;
  skippedUnknownRecipient: number;
}> {
  const client = getBscPublicClient();
  const token = getUsdtTokenAddress().toLowerCase();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const latestBlock = await client.getBlockNumber();

  const { depositOwners, receiving } = await buildWatchAddresses();

  let matched = 0;
  let depositMatched = 0;
  let transfersProcessed = 0;
  let skippedUnknownRecipient = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;

    const transfer = decodeTransferLog(log);
    if (!transfer) continue;
    transfersProcessed += 1;

    const result = await processTransfer(transfer, receiving, depositOwners);
    if (result.checkout) matched += 1;
    if (result.deposit) depositMatched += 1;

    if (
      !result.checkout &&
      !result.deposit &&
      !(receiving && addressesEqual(transfer.toAddress, receiving))
    ) {
      skippedUnknownRecipient += 1;
    }
  }

  return {
    matched,
    depositMatched,
    blockNumber: receipt.blockNumber,
    latestBlock,
    transfersProcessed,
    skippedUnknownRecipient,
  };
}
