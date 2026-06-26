import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { prisma } from "@/lib/db";

export type ScannedTransfer = {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
};

export async function updatePaymentConfirmations(paymentOrderId?: string) {
  const receiving = getReceivingWallet();
  if (!receiving) return;

  const client = getBscPublicClient();
  const latestBlock = await client.getBlockNumber();

  const orders = await prisma.usdtPaymentOrder.findMany({
    where: {
      status: { in: ["detecting", "confirming"] },
      txHash: { not: null },
      ...(paymentOrderId ? { id: paymentOrderId } : {}),
    },
  });

  for (const order of orders) {
    if (!order.txHash || order.blockNumber == null) continue;

    const confirmations = Number(latestBlock - BigInt(order.blockNumber) + 1n);
    const nextStatus =
      confirmations >= order.requiredConfirmations
        ? "confirming"
        : confirmations > 0
          ? "confirming"
          : "detecting";

    await prisma.usdtPaymentOrder.update({
      where: { id: order.id },
      data: { confirmations, status: nextStatus },
    });

    await prisma.usdtPayment.updateMany({
      where: { paymentOrderId: order.id },
      data: { confirmations },
    });

    if (confirmations >= order.requiredConfirmations) {
      const { fulfillPaymentOrder } = await import("@/payments/services/fulfill-payment-order");
      await fulfillPaymentOrder(order.id);
    }
  }
}
