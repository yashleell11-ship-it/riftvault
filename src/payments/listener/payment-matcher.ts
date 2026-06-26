import { prisma } from "@/lib/db";
import { addressesEqual } from "@/payments/blockchain/amounts";
import {
  getReceivingWallet,
  getRequiredConfirmations,
} from "@/payments/blockchain/config";
import {
  findPendingPaymentOrders,
  isTransferProcessed,
  logPaymentTransaction,
} from "@/payments/database/payment-repository";
import type { ScannedTransfer } from "@/payments/listener/transfer-scanner";

export async function processDetectedTransfer(
  transfer: ScannedTransfer,
  restrictToPaymentOrderId?: string
): Promise<{ matched: boolean; paymentOrderId?: string }> {
  const receiving = getReceivingWallet();
  if (!receiving || !addressesEqual(transfer.toAddress, receiving)) {
    return { matched: false };
  }

  if (await isTransferProcessed(prisma, transfer.txHash, transfer.logIndex)) {
    return { matched: false };
  }

  const pending = await findPendingPaymentOrders(prisma);
  const candidates = pending.filter((o) => {
    if (restrictToPaymentOrderId && o.id !== restrictToPaymentOrderId) return false;
    return o.expectedAmountRaw === transfer.amountRaw;
  });

  if (candidates.length === 0) {
    return { matched: false };
  }

  // Oldest matching pending order wins
  const order = candidates[0];

  const existingTx = await prisma.usdtPaymentOrder.findFirst({
    where: { txHash: transfer.txHash, id: { not: order.id } },
  });
  if (existingTx) {
    return { matched: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.usdtPayment.create({
      data: {
        paymentOrderId: order.id,
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
        blockNumber: Number(transfer.blockNumber),
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        amountRaw: transfer.amountRaw,
        status: "detected",
      },
    });

    await tx.usdtPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: "detecting",
        txHash: transfer.txHash,
        blockNumber: Number(transfer.blockNumber),
        fromAddress: transfer.fromAddress,
        confirmations: 1,
        requiredConfirmations: getRequiredConfirmations(),
      },
    });

    await logPaymentTransaction(tx, {
      paymentOrderId: order.id,
      eventType: "detected",
      message: "On-chain USDT transfer detected",
      data: {
        txHash: transfer.txHash,
        blockNumber: Number(transfer.blockNumber),
        amountRaw: transfer.amountRaw,
      },
    });
  });

  return { matched: true, paymentOrderId: order.id };
}
