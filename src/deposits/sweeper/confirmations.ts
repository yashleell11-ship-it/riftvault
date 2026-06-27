import type { PublicClient, TransactionReceipt } from "viem";
import { getSweepTxConfirmations, getSweepTxWaitMs } from "@/deposits/sweeper/config";
import { logSweepEvent } from "@/deposits/sweeper/logger";

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isReceiptWaitTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "WaitForTransactionReceiptTimeoutError" ||
    error.message.includes("Timed out while waiting for transaction")
  );
}

export { isReceiptWaitTimeout };

export async function getConfirmations(
  client: PublicClient,
  receipt: TransactionReceipt
): Promise<number> {
  const latest = await client.getBlockNumber();
  return Number(latest - receipt.blockNumber + 1n);
}

/**
 * Liveness of a previously-submitted tx.
 *  - "mined":   has a receipt (success or revert).
 *  - "pending": no receipt but still visible in the mempool.
 *  - "dropped": neither mined nor in the mempool — safe to re-send, because a
 *               dropped tx never advanced the sender's nonce, so a fresh send
 *               reuses the same nonce and only one of them can ever mine.
 */
export async function getTxLiveness(
  client: PublicClient,
  txHash: `0x${string}`
): Promise<"mined" | "pending" | "dropped"> {
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (receipt) return "mined";
  const tx = await client.getTransaction({ hash: txHash }).catch(() => null);
  return tx ? "pending" : "dropped";
}

/** True when tx is mined successfully with enough confirmations. */
export async function isTransactionConfirmed(
  client: PublicClient,
  txHash: `0x${string}`,
  required = getSweepTxConfirmations()
): Promise<boolean> {
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt || receipt.status !== "success") return false;
  const confirmations = await getConfirmations(client, receipt);
  return confirmations >= required;
}

/** Wait for BSC confirmations — instant return if already confirmed on-chain. */
export async function waitForConfirmations(
  client: PublicClient,
  txHash: `0x${string}`,
  required: number
): Promise<TransactionReceipt> {
  const timeout = getSweepTxWaitMs();
  const pollingInterval = 3_000;
  const started = Date.now();

  const existing = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (existing) {
    const confirmations = await getConfirmations(client, existing);
    if (confirmations >= required) {
      if (existing.status !== "success") {
        throw new Error(`Transaction reverted: ${txHash}`);
      }
      return existing;
    }
  }

  logSweepEvent("Waiting for tx confirmations", {
    depositId: "—",
    step: "wait_confirmations",
    sweepTxHash: txHash,
    amount: String(required),
  });

  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      confirmations: required,
      timeout,
      pollingInterval,
    });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted: ${txHash}`);
    }
    return receipt;
  } catch (error) {
    if (!isReceiptWaitTimeout(error)) throw error;

    logSweepEvent("Receipt wait timed out — polling fallback", {
      depositId: "—",
      step: "wait_confirmations_fallback",
      sweepTxHash: txHash,
    });

    while (Date.now() - started < timeout) {
      const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
      if (receipt) {
        const confirmations = await getConfirmations(client, receipt);
        if (confirmations >= required) {
          if (receipt.status !== "success") {
            throw new Error(`Transaction reverted: ${txHash}`);
          }
          return receipt;
        }
      }
      await sleep(pollingInterval);
    }

    throw error;
  }
}
