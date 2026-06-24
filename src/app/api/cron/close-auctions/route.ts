import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";
import { createNotification } from "@/lib/notifications";

// Protected by CRON_SECRET in production (set in Vercel env vars).
// Vercel injects the Authorization header automatically from vercel.json crons.
function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: allow unauthenticated
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.auction.findMany({
    where: { status: "active", endAt: { lt: new Date() } },
    include: { nft: { select: { name: true } } },
  });

  let closed = 0;
  for (const auction of expired) {
    await prisma.$transaction(async (tx) => {
      if (auction.highestBidderId && auction.highestBid) {
        const currency = normalizeCurrency(auction.currency);
        await debitWallet(tx, { userId: auction.highestBidderId, amount: auction.highestBid, currency, type: "purchase", description: `Auction won: ${auction.nft.name}` });
        await creditWallet(tx, { userId: auction.sellerId, amount: auction.highestBid, currency, type: "sale", description: `Auction sold: ${auction.nft.name}` });
        await tx.nft.update({ where: { id: auction.nftId }, data: { ownerId: auction.highestBidderId, status: "available" } });
        await tx.order.create({ data: { nftId: auction.nftId, buyerId: auction.highestBidderId, sellerId: auction.sellerId, price: auction.highestBid, currency, status: "completed" } });
        await createNotification(tx as never, { userId: auction.highestBidderId, type: "auction_won", title: "You won the auction!", body: `You won ${auction.nft.name} for ${auction.highestBid} ${auction.currency}.`, link: `/explore/${auction.nftId}` });
      } else {
        await tx.nft.update({ where: { id: auction.nftId }, data: { status: "available" } });
      }
      await tx.auction.update({ where: { id: auction.id }, data: { status: "ended" } });
    });
    closed++;
  }
  return NextResponse.json({ closed });
}
