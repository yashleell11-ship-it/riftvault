import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof import("@/lib/db").prisma;

export async function createNotification(
  tx: Tx,
  params: { userId: string; type: string; title: string; body: string; link?: string }
) {
  return (tx as Prisma.TransactionClient).notification.create({ data: params });
}
