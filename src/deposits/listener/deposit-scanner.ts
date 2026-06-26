import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { addressesEqual } from "@/payments/blockchain/amounts";
import {
  decodeTransferLog,
  fetchUsdtTransferLogs,
} from "@/payments/blockchain/log-scanner";
import {
  getListenerCursor,
  setListenerCursor,
} from "@/payments/database/payment-repository";
import { DEPOSIT_LISTENER_STATE_ID, DEPOSIT_ADDRESS_ROTATION_STATE_ID, getDepositScanMaxAddressesPerTick } from "@/deposits/blockchain/config";
import { getAddressOwnerMap } from "@/deposits/services/provision-addresses";
import {
  rawUsdtToFloat,
  updateDepositConfirmations,
} from "@/deposits/services/confirm-deposit";
import { uniqueDepositAddressesEnabled } from "@/lib/env";

/** Scan BSC USDT transfers to unique user deposit addresses. */
export async function scanUserDepositTransfers(options?: {
  maxBlocks?: number;
  /** When set, only scan these deposit addresses (e.g. current user on wallet page). */
  onlyAddresses?: `0x${string}`[];
}) {
  if (!uniqueDepositAddressesEnabled()) {
    return { scanned: 0, matched: 0 };
  }

  const addressMap = await getAddressOwnerMap();
  if (addressMap.size === 0) {
    return { scanned: 0, matched: 0 };
  }

  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();

  const cursor = await getListenerCursor(prisma, DEPOSIT_LISTENER_STATE_ID);
  const lookback = BigInt(process.env.PAYMENT_LISTENER_LOOKBACK_BLOCKS ?? 100);
  const fromBlock =
    cursor?.lastBlock != null
      ? cursor.lastBlock + 1n
      : latestBlock > lookback
        ? latestBlock - lookback
        : 0n;

  const maxBlocks = BigInt(options?.maxBlocks ?? 30);
  const toBlock =
    fromBlock + maxBlocks > latestBlock ? latestBlock : fromBlock + maxBlocks;

  if (fromBlock > toBlock) {
    await updateDepositConfirmations();
    return { scanned: 0, matched: 0 };
  }

  const depositAddresses = [...addressMap.keys()].sort() as `0x${string}`[];
  const receiving = getReceivingWallet()?.toLowerCase();
  let scanAddresses = receiving
    ? depositAddresses.filter((addr) => !addressesEqual(addr, receiving))
    : depositAddresses;

  if (options?.onlyAddresses?.length) {
    const allowed = new Set(
      options.onlyAddresses.map((a) => a.toLowerCase())
    );
    scanAddresses = scanAddresses.filter((addr) => allowed.has(addr));
  }

  if (scanAddresses.length === 0) {
    await setListenerCursor(prisma, DEPOSIT_LISTENER_STATE_ID, toBlock);
    await updateDepositConfirmations();
    return { scanned: Number(toBlock - fromBlock + 1n), matched: 0 };
  }

  const maxAddresses = options?.onlyAddresses?.length
    ? scanAddresses.length
    : getDepositScanMaxAddressesPerTick();
  const useRotation = !options?.onlyAddresses?.length && scanAddresses.length > maxAddresses;
  const rotation = useRotation
    ? await getListenerCursor(prisma, DEPOSIT_ADDRESS_ROTATION_STATE_ID)
    : null;
  const offset =
    useRotation && scanAddresses.length > 0
      ? Number(rotation?.lastBlock ?? 0n) % scanAddresses.length
      : 0;
  const count = Math.min(maxAddresses, scanAddresses.length);
  const addressesThisTick: `0x${string}`[] = [];
  for (let i = 0; i < count; i++) {
    addressesThisTick.push(scanAddresses[(offset + i) % scanAddresses.length]!);
  }
  const nextOffset = (offset + count) % scanAddresses.length;
  const completedAddressRotation =
    !useRotation || count >= scanAddresses.length || nextOffset === 0;

  const logs = await fetchUsdtTransferLogs(client, {
    fromBlock,
    toBlock,
    toAddresses: addressesThisTick,
  });

  let matched = 0;

  for (const log of logs) {
    const transfer = decodeTransferLog(log);
    if (!transfer) continue;

    const owner = addressMap.get(transfer.toAddress);
    if (!owner) continue;

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

  if (useRotation) {
    await setListenerCursor(prisma, DEPOSIT_ADDRESS_ROTATION_STATE_ID, BigInt(nextOffset));
  }
  if (completedAddressRotation) {
    await setListenerCursor(prisma, DEPOSIT_LISTENER_STATE_ID, toBlock);
  }
  await updateDepositConfirmations();

  return {
    scanned: Number(toBlock - fromBlock + 1n),
    matched,
  };
}
