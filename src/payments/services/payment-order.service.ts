import { prisma } from "@/lib/db";
import {
  getReceivingWallet,
  getUsdtContractAddress,
  getBscChainId,
  getPaymentExpiryMinutes,
  getRequiredConfirmations,
  isUsdtPaymentsEnabled,
} from "@/payments/blockchain/config";
import { buildUniquePaymentAmount } from "@/payments/blockchain/amounts";
import {
  findPaymentOrderById,
  logPaymentTransaction,
} from "@/payments/database/payment-repository";

async function allocateUniquePaymentAmount(listPrice: number) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const built = buildUniquePaymentAmount(listPrice);
    const clash = await prisma.usdtPaymentOrder.findFirst({
      where: {
        expectedAmountRaw: built.amountRaw,
        status: { in: ["pending", "detecting", "confirming"] },
      },
      select: { id: true },
    });
    if (!clash) return built;
  }
  throw new Error("Could not allocate unique payment amount — try again");
}

export async function createUsdtPaymentOrder(params: {
  userId: string;
  nftId: string;
}) {
  if (!isUsdtPaymentsEnabled()) {
    throw new Error("USDT payments are not configured");
  }

  const receiving = getReceivingWallet()!;

  const nft = await prisma.nft.findUnique({
    where: { id: params.nftId },
    include: { listing: true },
  });

  if (!nft?.listing || nft.listing.status !== "active" || nft.status !== "listed") {
    throw new Error("This artifact is not for sale");
  }

  if (nft.ownerId === params.userId) {
    throw new Error("You cannot buy your own listing");
  }

  const { displayAmount, amountRaw } = await allocateUniquePaymentAmount(nft.listing.price);
  const expiresAt = new Date(Date.now() + getPaymentExpiryMinutes() * 60_000);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.usdtPaymentOrder.create({
      data: {
        userId: params.userId,
        nftId: params.nftId,
        productName: nft.name,
        listPrice: nft.listing!.price,
        expectedAmount: displayAmount,
        expectedAmountRaw: amountRaw,
        receivingWallet: receiving.toLowerCase(),
        chainId: getBscChainId(),
        tokenContract: getUsdtContractAddress().toLowerCase(),
        status: "pending",
        requiredConfirmations: getRequiredConfirmations(),
        expiresAt,
      },
    });

    await logPaymentTransaction(tx, {
      paymentOrderId: created.id,
      eventType: "created",
      message: "Payment order created",
      data: {
        expectedAmount: displayAmount,
        receivingWallet: receiving,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return created;
  });

  return order;
}

export async function getPaymentOrderStatus(paymentOrderId: string, userId?: string) {
  const order = await findPaymentOrderById(prisma, paymentOrderId);
  if (!order) return null;
  if (userId && order.userId !== userId) return null;

  if (order.status === "pending" && order.expiresAt < new Date()) {
    await prisma.usdtPaymentOrder.update({
      where: { id: order.id },
      data: { status: "expired" },
    });
    await logPaymentTransaction(prisma, {
      paymentOrderId: order.id,
      eventType: "expired",
      message: "Payment window expired",
    });
    return { ...order, status: "expired" };
  }

  return order;
}

export type PaymentStatusPayload = {
  id: string;
  status: string;
  expectedAmount: string;
  receivingWallet: string;
  productName: string;
  listPrice: number;
  txHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  paidAt: string | null;
  expiresAt: string;
  chainId: number;
  tokenContract: string;
  marketplaceOrderId: string | null;
};

export function toStatusPayload(order: {
  id: string;
  status: string;
  expectedAmount: string;
  receivingWallet: string;
  productName: string;
  listPrice: number;
  txHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  paidAt: Date | null;
  expiresAt: Date;
  chainId: number;
  tokenContract: string;
  marketplaceOrderId: string | null;
}): PaymentStatusPayload {
  return {
    id: order.id,
    status: order.status,
    expectedAmount: order.expectedAmount,
    receivingWallet: order.receivingWallet,
    productName: order.productName,
    listPrice: order.listPrice,
    txHash: order.txHash,
    confirmations: order.confirmations,
    requiredConfirmations: order.requiredConfirmations,
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt.toISOString(),
    chainId: order.chainId,
    tokenContract: order.tokenContract,
    marketplaceOrderId: order.marketplaceOrderId,
  };
}
