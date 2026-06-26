import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PaymentDb = Prisma.TransactionClient | typeof prisma;

export async function findPaymentOrderById(db: PaymentDb, id: string) {
  return db.usdtPaymentOrder.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export async function findPendingPaymentOrders(db: PaymentDb) {
  return db.usdtPaymentOrder.findMany({
    where: {
      status: { in: ["pending", "detecting", "confirming"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findPaymentOrderByTxHash(db: PaymentDb, txHash: string) {
  return db.usdtPaymentOrder.findUnique({
    where: { txHash: txHash.toLowerCase() },
  });
}

export async function logPaymentTransaction(
  db: PaymentDb,
  params: {
    paymentOrderId: string;
    eventType: string;
    message?: string;
    data?: Record<string, unknown>;
  }
) {
  return db.paymentTransaction.create({
    data: {
      paymentOrderId: params.paymentOrderId,
      eventType: params.eventType,
      message: params.message,
      data: params.data ? JSON.stringify(params.data) : null,
    },
  });
}

export async function getListenerCursor(db: PaymentDb, stateId: string) {
  return db.paymentListenerState.findUnique({ where: { id: stateId } });
}

export async function setListenerCursor(db: PaymentDb, stateId: string, lastBlock: bigint) {
  return db.paymentListenerState.upsert({
    where: { id: stateId },
    create: { id: stateId, lastBlock },
    update: { lastBlock },
  });
}

export async function isTransferProcessed(
  db: PaymentDb,
  txHash: string,
  logIndex: number
) {
  const row = await db.usdtPayment.findUnique({
    where: { txHash_logIndex: { txHash: txHash.toLowerCase(), logIndex } },
  });
  return Boolean(row);
}
