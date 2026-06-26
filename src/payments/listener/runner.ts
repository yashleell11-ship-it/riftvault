import { expireStalePaymentOrders } from "@/payments/services/expire-orders.service";
import { updatePaymentConfirmations } from "@/payments/listener/transfer-scanner";
import {
  scanUsdtTransfersUnified,
  type UnifiedScanOptions,
} from "@/payments/listener/unified-scanner";
import { updateDepositConfirmations } from "@/deposits/services/confirm-deposit";

export type PaymentListenerTickOptions = UnifiedScanOptions & {
  paymentOrderId?: string;
};

/** Single listener tick — checkout + wallet deposits, one blockchain cursor. */
export async function runPaymentListenerTick(options?: PaymentListenerTickOptions) {
  await expireStalePaymentOrders();

  const scan = await scanUsdtTransfersUnified(options);

  await updatePaymentConfirmations(options?.paymentOrderId);
  await updateDepositConfirmations();

  return {
    scanned: scan.scanned,
    matched: scan.matched,
    depositMatched: scan.depositMatched,
    latestBlock: scan.latestBlock,
    fromBlock: scan.fromBlock,
    toBlock: scan.toBlock,
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
