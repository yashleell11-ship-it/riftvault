import type { Log, PublicClient } from "viem";
import { ERC20_TRANSFER_EVENT, getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";

/** Max blocks per eth_getLogs call (BSC public RPCs often cap ~50–100). */
export function getLogChunkBlockSize(): bigint {
  const n = Number(process.env.BSC_LOG_CHUNK_BLOCKS ?? 50);
  const size = Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
  return BigInt(Math.min(500, Math.max(1, size)));
}

type TransferLogQuery = {
  fromBlock: bigint;
  toBlock: bigint;
  /** When set, only transfers to these addresses (required for deposit scans). */
  toAddresses?: `0x${string}`[];
};

/**
 * Fetch USDT Transfer logs in small block chunks to stay within RPC limits.
 * Never scans the full USDT contract without a `to` filter — that exceeds BSC limits immediately.
 */
export async function fetchUsdtTransferLogs(
  client: PublicClient,
  query: TransferLogQuery
): Promise<Log[]> {
  const { fromBlock, toBlock, toAddresses } = query;
  if (fromBlock > toBlock) return [];

  if (!toAddresses?.length) {
    throw new Error(
      "fetchUsdtTransferLogs requires toAddresses — unfiltered USDT getLogs exceeds BSC RPC limits"
    );
  }

  const token = getUsdtTokenAddress();
  const chunkSize = getLogChunkBlockSize();
  const uniqueTo = [...new Set(toAddresses.map((a) => a.toLowerCase() as `0x${string}`))];
  const allLogs: Log[] = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;

    for (const to of uniqueTo) {
      const logs = await client.getLogs({
        address: token,
        event: ERC20_TRANSFER_EVENT,
        args: { to },
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...logs);
    }
  }

  return allLogs;
}

export function decodeTransferLog(log: Log): {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
} | null {
  if (!log.topics[1] || !log.topics[2] || log.data === undefined) return null;
  if (
    !log.transactionHash ||
    log.logIndex == null ||
    log.blockNumber == null
  ) {
    return null;
  }

  return {
    txHash: log.transactionHash.toLowerCase(),
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
    fromAddress: `0x${log.topics[1].slice(-40)}`.toLowerCase(),
    toAddress: `0x${log.topics[2].slice(-40)}`.toLowerCase(),
    amountRaw: BigInt(log.data).toString(),
  };
}
