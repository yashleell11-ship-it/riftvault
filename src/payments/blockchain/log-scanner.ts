import type { Log, PublicClient } from "viem";
import { ERC20_TRANSFER_EVENT, getUsdtTokenAddress } from "@/payments/blockchain/usdt-bep20";

/** Max blocks per eth_getLogs call (BSC public RPCs often cap ~10–50). */
export function getLogChunkBlockSize(): bigint {
  const n = Number(process.env.BSC_LOG_CHUNK_BLOCKS ?? 20);
  const size = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
  return BigInt(Math.min(200, Math.max(1, size)));
}

const ADDRESS_BATCH_SIZE = 25;

type TransferLogQuery = {
  fromBlock: bigint;
  toBlock: bigint;
  /** When set, only transfers to these addresses (required for deposit scans). */
  toAddresses?: `0x${string}`[];
};

function isRpcLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: number }).code;
  if (code === -32005) return true;
  const message = String((error as Error).message ?? "").toLowerCase();
  return message.includes("limit exceeded") || message.includes("exceeds defined limit");
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

    for (let i = 0; i < uniqueTo.length; i += ADDRESS_BATCH_SIZE) {
      const batch = uniqueTo.slice(i, i + ADDRESS_BATCH_SIZE);

      await Promise.all(
        batch.map(async (to) => {
          const pending: { from: bigint; to: bigint }[] = [{ from: start, to: end }];

          while (pending.length > 0) {
            const range = pending.pop()!;
            try {
              const logs = await client.getLogs({
                address: token,
                event: ERC20_TRANSFER_EVENT,
                args: { to },
                fromBlock: range.from,
                toBlock: range.to,
              });
              allLogs.push(...logs);
            } catch (error) {
              if (isRpcLimitError(error) && range.from < range.to) {
                const mid = range.from + (range.to - range.from) / 2n;
                pending.push({ from: mid + 1n, to: range.to });
                pending.push({ from: range.from, to: mid });
              } else {
                throw error;
              }
            }
          }
        })
      );
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
