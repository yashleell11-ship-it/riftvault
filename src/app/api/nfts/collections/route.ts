import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, imageUrl: true, floorPrice: true, _count: { select: { nfts: true } } },
  });
  return NextResponse.json({ collections });
}
