import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const nft = await prisma.nft.findUnique({
    where: { id },
    include: {
      collection: true,
      listing: true,
      owner: { select: { id: true, displayName: true } },
    },
  });

  if (!nft) {
    return NextResponse.json({ error: "NFT not found" }, { status: 404 });
  }

  const related = await prisma.nft.findMany({
    where: {
      collectionId: nft.collectionId,
      id: { not: nft.id },
    },
    include: {
      collection: { select: { name: true, slug: true } },
      listing: { select: { price: true, currency: true } },
    },
    take: 4,
  });

  return NextResponse.json({ nft, related });
}
