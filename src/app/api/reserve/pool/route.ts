import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const nfts = await prisma.nft.findMany({
    where: {
      status: "available",
      ownerId: null,
      listing: null,
    },
    include: {
      collection: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 48,
  });

  return NextResponse.json({ nfts });
}
