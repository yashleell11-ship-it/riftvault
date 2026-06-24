import type { Prisma } from "@prisma/client";
import { calcReferralCommission, calcTradingReward } from "@/lib/earn";
import { getDefaultCurrency } from "@/lib/currency";
import { computeLevelFromTradeCount } from "@/lib/levels";
import { creditWallet, debitWallet } from "@/lib/wallet";

type Tx = Prisma.TransactionClient;

export async function countCompletedTrades(tx: Tx, userId: string) {
  return tx.order.count({
    where: {
      status: "completed",
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
  });
}

export async function syncUserLevel(tx: Tx, userId: string) {
  const tradeCount = await countCompletedTrades(tx, userId);
  const level = computeLevelFromTradeCount(tradeCount);
  await tx.user.update({
    where: { id: userId },
    data: { level },
  });
  return level;
}

async function getReferralChain(
  tx: Tx,
  buyerId: string
): Promise<{ l1: string | null; l2: string | null }> {
  const buyer = await tx.user.findUnique({
    where: { id: buyerId },
    select: {
      referredBy: {
        select: {
          id: true,
          referredById: true,
        },
      },
    },
  });

  const l1 = buyer?.referredBy?.id ?? null;
  const l2 = buyer?.referredBy?.referredById ?? null;

  return { l1, l2 };
}

export async function creditOrderRewards(
  tx: Tx,
  order: { id: string; price: number; buyerId: string; sellerId: string; currency?: string },
  referralChain?: { l1: string | null; l2: string | null }
) {
  const currency = order.currency ?? getDefaultCurrency();
  const chain = referralChain ?? (await getReferralChain(tx, order.buyerId));
  const tradingAmount = calcTradingReward(order.price);

  await tx.earning.create({
    data: {
      userId: order.sellerId,
      orderId: order.id,
      type: "trading",
      amount: tradingAmount,
      currency,
      description: "Trading reward (2.5% of sale)",
    },
  });

  await creditWallet(tx, {
    userId: order.sellerId,
    amount: tradingAmount,
    currency,
    type: "reward",
    description: "Trading reward",
    orderId: order.id,
  });

  if (chain.l1) {
    const l1Amount = calcReferralCommission(order.price, 1);
    if (l1Amount > 0) {
      await tx.earning.create({
        data: {
          userId: chain.l1,
          orderId: order.id,
          type: "referral",
          amount: l1Amount,
          currency,
          description: "Referral commission (level 1)",
        },
      });
      await creditWallet(tx, {
        userId: chain.l1,
        amount: l1Amount,
        currency,
        type: "reward",
        description: "Referral commission (L1)",
        orderId: order.id,
      });
    }
  }

  if (chain.l2) {
    const l2Amount = calcReferralCommission(order.price, 2);
    if (l2Amount > 0) {
      await tx.earning.create({
        data: {
          userId: chain.l2,
          orderId: order.id,
          type: "referral",
          amount: l2Amount,
          currency,
          description: "Referral commission (level 2)",
        },
      });
      await creditWallet(tx, {
        userId: chain.l2,
        amount: l2Amount,
        currency,
        type: "reward",
        description: "Referral commission (L2)",
        orderId: order.id,
      });
    }
  }

  await syncUserLevel(tx, order.buyerId);
  await syncUserLevel(tx, order.sellerId);
}

export async function settleOrderPayment(
  tx: Tx,
  order: {
    id: string;
    buyerId: string;
    sellerId: string;
    price: number;
    currency?: string;
    nftName?: string;
  }
) {
  const currency = order.currency ?? getDefaultCurrency();
  const label = order.nftName ? `Purchase: ${order.nftName}` : "NFT purchase";

  await debitWallet(tx, {
    userId: order.buyerId,
    amount: order.price,
    currency,
    type: "purchase",
    description: label,
    orderId: order.id,
  });

  await creditWallet(tx, {
    userId: order.sellerId,
    amount: order.price,
    currency,
    type: "sale",
    description: order.nftName ? `Sale: ${order.nftName}` : "NFT sale",
    orderId: order.id,
  });
}

// Re-export for buy route
export { getWalletBalance } from "@/lib/wallet";
