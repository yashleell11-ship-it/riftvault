import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  nftId: z.string().min(1),
  startPrice: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  currency: z.string().default("USDT"),
  durationHours: z.number().int().min(1).max(168).default(24),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nftId = searchParams.get("nftId");
  if (!nftId) return NextResponse.json({ error: "nftId required" }, { status: 400 });

  const auction = await prisma.auction.findUnique({
    where: { nftId },
    select: { id: true, startPrice: true, highestBid: true, currency: true, endAt: true, status: true },
  });
  if (!auction) return NextResponse.json({ auction: null, bids: [] });

  const bids = await prisma.bid.findMany({
    where: { auctionId: auction.id },
    include: { bidder: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ auction: { ...auction, startingBid: auction.startPrice }, bids });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { nftId, startPrice, reservePrice, currency, durationHours } = parsed.data;
  const nft = await prisma.nft.findUnique({ where: { id: nftId, ownerId: user.id } });
  if (!nft) return NextResponse.json({ error: "NFT not found or not owned by you" }, { status: 404 });

  const existing = await prisma.auction.findUnique({ where: { nftId } });
  if (existing) return NextResponse.json({ error: "Auction already exists for this NFT" }, { status: 400 });

  const endAt = new Date(Date.now() + durationHours * 3600 * 1000);
  const auction = await prisma.auction.create({ data: { nftId, sellerId: user.id, startPrice, reservePrice, currency, endAt, status: "active" } });
  await prisma.nft.update({ where: { id: nftId }, data: { status: "auction" } });
  return NextResponse.json({ auction }, { status: 201 });
}
