import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { creditOrderRewards } from "@/lib/orders";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";
import { createNotification } from "@/lib/notifications";

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.auction.findMany({
    where: { status: "active", endAt: { lt: new Date() } },
    include: { nft: { select: { name: true, ownerId: true } } },
  });

  let closed = 0;
  for (const auction of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.auction.findUnique({ where: { id: auction.id } });
        if (!current || current.status !== "active") return;

        const meetsReserve =
          current.highestBid != null &&
          current.highestBidderId != null &&
          (!current.reservePrice || current.highestBid >= current.reservePrice);

        if (meetsReserve && current.highestBidderId && current.highestBid) {
          const currency = normalizeCurrency(current.currency);
          const buyerBal = await import("@/lib/wallet").then((m) =>
            m.getWalletBalance(tx, current.highestBidderId!, currency)
          );
          if (buyerBal < current.highestBid) {
            await tx.auction.update({
              where: { id: current.id },
              data: { status: "ended" },
            });
            await tx.nft.update({
              where: { id: current.nftId },
              data: { status: "reserved", ownerId: current.sellerId },
            });
            return;
          }

          const order = await tx.order.create({
            data: {
              nftId: current.nftId,
              buyerId: current.highestBidderId,
              sellerId: current.sellerId,
              price: current.highestBid,
              currency,
              status: "completed",
            },
          });

          await debitWallet(tx, {
            userId: current.highestBidderId,
            amount: current.highestBid,
            currency,
            type: "purchase",
            description: `Auction won: ${auction.nft.name}`,
            orderId: order.id,
          });
          await creditWallet(tx, {
            userId: current.sellerId,
            amount: current.highestBid,
            currency,
            type: "sale",
            description: `Auction sold: ${auction.nft.name}`,
            orderId: order.id,
          });

          await tx.nft.update({
            where: { id: current.nftId },
            data: { ownerId: current.highestBidderId, status: "reserved" },
          });

          await tx.listing.updateMany({
            where: { nftId: current.nftId, status: "active" },
            data: { status: "cancelled" },
          });

          await creditOrderRewards(tx, order);

          await tx.auction.update({ where: { id: current.id }, data: { status: "ended" } });
        } else {
          await tx.nft.update({
            where: { id: current.nftId },
            data: { status: "reserved", ownerId: current.sellerId },
          });
          await tx.auction.update({ where: { id: current.id }, data: { status: "ended" } });
        }
      });

      const ended = await prisma.auction.findUnique({ where: { id: auction.id } });
      if (
        ended?.status === "ended" &&
        ended.highestBidderId &&
        ended.highestBid &&
        (!ended.reservePrice || ended.highestBid >= ended.reservePrice)
      ) {
        await createNotification(prisma, {
          userId: ended.highestBidderId,
          type: "auction_won",
          title: "You won the auction!",
          body: `You won ${auction.nft.name} for ${ended.highestBid} ${ended.currency}.`,
          link: `/explore/${auction.nftId}`,
        });
      }

      closed++;
    } catch (error) {
      console.error("[close-auctions] failed:", auction.id, error);
    }
  }

  return NextResponse.json({ closed });
}
