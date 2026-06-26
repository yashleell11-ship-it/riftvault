import {
  scanUsdtTransfers,
  updatePaymentConfirmations,
} from "@/payments/listener/transfer-scanner";
import { expireStalePaymentOrders } from "@/payments/services/expire-orders.service";
import { scanUserDepositTransfers } from "@/deposits/listener/deposit-scanner";

/** Single listener tick — safe to call from cron, API poll, or standalone script. */
export async function runPaymentListenerTick(options?: {
  paymentOrderId?: string;
  maxBlocks?: number;
  /** Skip unique-address deposit scan (use for serverless cron — deposits scan on wallet poll). */
  skipDeposits?: boolean;
}) {
  await expireStalePaymentOrders();

  const checkoutScan = await scanUsdtTransfers({
    paymentOrderId: options?.paymentOrderId,
    maxBlocks: options?.maxBlocks,
  });

  await updatePaymentConfirmations(options?.paymentOrderId);

  const depositScan = options?.skipDeposits
    ? { scanned: 0, matched: 0 }
    : await scanUserDepositTransfers({
        maxBlocks: options?.maxBlocks,
      });

  return { ...checkoutScan, depositMatched: depositScan.matched };
}
