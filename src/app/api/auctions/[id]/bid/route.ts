import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { getWalletBalance } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";

const schema = z.object({ amount: z.number().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const auction = await prisma.auction.findUnique({ where: { id }, include: { nft: { select: { name: true } } } });
  if (!auction || auction.status !== "active") return NextResponse.json({ error: "Auction not found or ended" }, { status: 404 });
  if (auction.sellerId === user.id) return NextResponse.json({ error: "Cannot bid on your own auction" }, { status: 400 });
  if (auction.endAt < new Date()) return NextResponse.json({ error: "Auction has ended" }, { status: 400 });

  const minBid = auction.highestBid ? auction.highestBid * 1.01 : auction.startPrice;
  if (parsed.data.amount < minBid) return NextResponse.json({ error: `Minimum bid is ${minBid.toFixed(4)} ${auction.currency}` }, { status: 400 });

  const currency = normalizeCurrency(auction.currency);
  const balance = await prisma.$transaction(tx => getWalletBalance(tx, user.id, currency));
  if (balance < parsed.data.amount) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

  const bid = await prisma.$transaction(async (tx) => {
    const b = await tx.bid.create({ data: { auctionId: id, bidderId: user.id, amount: parsed.data.amount } });
    await tx.auction.update({ where: { id }, data: { highestBid: parsed.data.amount, highestBidderId: user.id } });
    return b;
  });

  if (auction.highestBidderId && auction.highestBidderId !== user.id) {
    await createNotification(prisma, { userId: auction.highestBidderId, type: "outbid", title: "You were outbid", body: `Someone placed a higher bid on ${auction.nft.name}.`, link: `/explore/${auction.nftId}` });
  }
  return NextResponse.json({ bid }, { status: 201 });
}
