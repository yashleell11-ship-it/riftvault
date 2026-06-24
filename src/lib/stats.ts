import { prisma } from "@/lib/db";

export async function getPlatformStats() {
  const [collections, nfts, listings, users, volume] = await Promise.all([
    prisma.collection.count(),
    prisma.nft.count(),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { price: true } }),
  ]);

  return {
    collections,
    nfts,
    activeListings: listings,
    traders: users,
    totalVolume: volume._sum.price ?? 0,
  };
}
