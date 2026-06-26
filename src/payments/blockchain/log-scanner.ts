import type { Log, PublicClient } from "viem";
import { ERC20_TRANSFER_EVENT, getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";

/** Max blocks per eth_getLogs call (BSC public RPCs often cap ~5–20). */
export function getLogChunkBlockSize(): bigint {
  const n = Number(process.env.BSC_LOG_CHUNK_BLOCKS ?? 10);
  const size = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
  return BigInt(Math.min(50, Math.max(1, size)));
}

const MAX_RPC_ATTEMPTS_PER_ADDRESS = 12;

type TransferLogQuery = {
  fromBlock: bigint;
  toBlock: bigint;
  /** When set, only transfers to these addresses (required for deposit scans). */
  toAddresses?: `0x${string}`[];
};

function isRpcLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: number }).code;
  if (code === -32005 || code === -32602) return true;
  const message = String((error as Error).message ?? "").toLowerCase();
  return (
    message.includes("limit exceeded") ||
    message.includes("exceeds defined limit") ||
    message.includes("timeout") ||
    message.includes("rate limit")
  );
}

async function getLogsWithSplit(
  client: PublicClient,
  token: `0x${string}`,
  to: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  const pending: { from: bigint; to: bigint; depth: number }[] = [
    { from: fromBlock, to: toBlock, depth: 0 },
  ];
  const logs: Log[] = [];
  let attempts = 0;

  while (pending.length > 0) {
    if (attempts >= MAX_RPC_ATTEMPTS_PER_ADDRESS) {
      console.warn(
        `[log-scanner] RPC budget exhausted for ${to} blocks ${fromBlock}-${toBlock}`
      );
      break;
    }
    attempts += 1;
    const range = pending.pop()!;
    try {
      const chunk = await client.getLogs({
        address: token,
        event: ERC20_TRANSFER_EVENT,
        args: { to },
        fromBlock: range.from,
        toBlock: range.to,
      });
      logs.push(...chunk);
    } catch (error) {
      if (
        isRpcLimitError(error) &&
        range.from < range.to &&
        range.depth < 4
      ) {
        const mid = range.from + (range.to - range.from) / 2n;
        pending.push({ from: mid + 1n, to: range.to, depth: range.depth + 1 });
        pending.push({ from: range.from, to: mid, depth: range.depth + 1 });
        continue;
      }

      if (isRpcLimitError(error)) {
        console.warn(
          `[log-scanner] skipping blocks ${range.from}-${range.to} for ${to}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }

      throw error;
    }
  }

  return logs;
}

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
      const logs = await getLogsWithSplit(client, token, to, start, end);
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
