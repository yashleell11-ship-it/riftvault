import { prisma } from "@/lib/db";
import { creditOrderRewards } from "@/lib/orders";
import { creditWallet } from "@/lib/wallet";
import { logPaymentTransaction } from "@/payments/database/payment-repository";
import { createNotification } from "@/lib/notifications";

/**
 * Mark payment order paid and complete the NFT marketplace order.
 * Buyer paid on-chain to RECEIVING_WALLET — credit seller ledger (platform custody).
 */
export async function fulfillPaymentOrder(paymentOrderId: string) {
  const paymentOrder = await prisma.usdtPaymentOrder.findUnique({
    where: { id: paymentOrderId },
  });

  if (!paymentOrder) throw new Error("Payment order not found");
  if (paymentOrder.status === "paid") return paymentOrder;
  if (!paymentOrder.txHash) throw new Error("No transaction linked");

  const nft = await prisma.nft.findUnique({
    where: { id: paymentOrder.nftId },
    include: { listing: true },
  });

  if (!nft?.listing || nft.listing.status !== "active") {
    await prisma.usdtPaymentOrder.update({
      where: { id: paymentOrderId },
      data: { status: "failed" },
    });
    await logPaymentTransaction(prisma, {
      paymentOrderId,
      eventType: "failed",
      message: "Listing no longer active",
    });
    throw new Error("Listing no longer available");
  }

  const sellerId = nft.ownerId ?? nft.listing.sellerId;
  const price = nft.listing.price;
  const currency = nft.listing.currency;

  const existingOrder = await prisma.order.findUnique({
    where: { txHash: paymentOrder.txHash },
  });
  if (existingOrder) {
    await prisma.usdtPaymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        status: "paid",
        paidAt: new Date(),
        marketplaceOrderId: existingOrder.id,
      },
    });
    return paymentOrder;
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.listing.updateMany({
      where: {
        id: nft.listing!.id,
        status: "active",
        nft: { id: paymentOrder.nftId, status: "listed" },
      },
      data: { status: "sold" },
    });

    if (claimed.count === 0) {
      throw new Error("Listing no longer available");
    }

    const marketplaceOrder = await tx.order.create({
      data: {
        nftId: paymentOrder.nftId,
        buyerId: paymentOrder.userId,
        sellerId,
        price,
        currency,
        paymentMethod: "usdt_bep20",
        txHash: paymentOrder.txHash!,
        status: "completed",
      },
    });

    await tx.nft.update({
      where: { id: paymentOrder.nftId },
      data: {
        ownerId: paymentOrder.userId,
        status: "reserved",
      },
    });

    await creditWallet(tx, {
      userId: sellerId,
      amount: price,
      currency,
      type: "sale",
      description: `Sale: ${nft.name} (USDT BEP20)`,
      orderId: marketplaceOrder.id,
    });

    await creditOrderRewards(tx, marketplaceOrder);

    await tx.usdtPaymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        status: "paid",
        paidAt: new Date(),
        marketplaceOrderId: marketplaceOrder.id,
      },
    });

    await tx.usdtPayment.updateMany({
      where: { paymentOrderId },
      data: { status: "confirmed" },
    });

    await logPaymentTransaction(tx, {
      paymentOrderId,
      eventType: "paid",
      message: "Payment confirmed and order fulfilled",
      data: { marketplaceOrderId: marketplaceOrder.id },
    });

    return marketplaceOrder;
  });

  await createNotification(prisma, {
    userId: paymentOrder.userId,
    type: "purchase",
    title: "Payment received",
    body: `Your USDT payment for ${paymentOrder.productName} is complete.`,
    link: "/dashboard/nfts",
  });

  return result;
}
