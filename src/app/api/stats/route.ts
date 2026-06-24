import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [collections, nfts, listings, users, volume] = await Promise.all([
    prisma.collection.count(),
    prisma.nft.count(),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { price: true } }),
  ]);

  return NextResponse.json({
    collections,
    nfts,
    activeListings: listings,
    traders: users,
    totalVolume: volume._sum.price ?? 0,
  });
}
