import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { nft: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.sellerId !== user.id) {
    return NextResponse.json({ error: "Not your listing" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.listing.update({
      where: { id },
      data: { status: "cancelled" },
    }),
    prisma.nft.update({
      where: { id: listing.nftId },
      data: { status: "reserved" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
