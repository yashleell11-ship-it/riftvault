import { expireStalePaymentOrders } from "@/payments/services/expire-orders.service";
import { updatePaymentConfirmations } from "@/payments/listener/transfer-scanner";
import {
  scanUsdtTransfersUnified,
  rescanUsdtTransactionByHash,
  type UnifiedScanOptions,
} from "@/payments/listener/unified-scanner";
import { updateDepositConfirmations } from "@/deposits/services/confirm-deposit";
import { runSweeperTick } from "@/deposits/sweeper/runner";
import { isDepositSweeperEnabled } from "@/deposits/sweeper/config";

export type PaymentListenerTickOptions = UnifiedScanOptions & {
  paymentOrderId?: string;
  /** When false, skip treasury sweep even if enabled (rescan-only ticks). */
  runSweeper?: boolean;
};

/** Single listener tick — checkout + wallet deposits, one blockchain cursor. */
export async function runPaymentListenerTick(options?: PaymentListenerTickOptions) {
  await expireStalePaymentOrders();

  const scan = await scanUsdtTransfersUnified(options);

  await updatePaymentConfirmations(options?.paymentOrderId);
  await updateDepositConfirmations();

  let sweep:
    | {
        pendingFound: number;
        completed: number;
        failed: number;
        errors: string[];
      }
    | undefined;

  if (options?.runSweeper !== false && isDepositSweeperEnabled()) {
    const tick = await runSweeperTick();
    sweep = {
      pendingFound: tick.pendingFound,
      completed: tick.completed,
      failed: tick.failed,
      errors: tick.errors,
    };
  }

  return {
    scanned: scan.scanned,
    matched: scan.matched,
    depositMatched: scan.depositMatched,
    latestBlock: scan.latestBlock,
    fromBlock: scan.fromBlock,
    toBlock: scan.toBlock,
    sweep,
  };
}

/** Admin / CLI historical rescan — idempotent, does not move the listener cursor by default. */
export async function rescanUsdtBlockRange(fromBlock: bigint, toBlock: bigint) {
  return scanUsdtTransfersUnified({
    fromBlock,
    toBlock,
    advanceCursor: false,
  });
}

export async function rescanUsdtTransaction(txHash: `0x${string}`) {
  return rescanUsdtTransactionByHash(txHash);
}
