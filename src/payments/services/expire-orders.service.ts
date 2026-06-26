import { prisma } from "@/lib/db";
import { logPaymentTransaction } from "@/payments/database/payment-repository";

export async function expireStalePaymentOrders() {
  const expired = await prisma.usdtPaymentOrder.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const row of expired) {
    await prisma.usdtPaymentOrder.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    await logPaymentTransaction(prisma, {
      paymentOrderId: row.id,
      eventType: "expired",
      message: "Payment window expired",
    });
  }

  return expired.length;
}
