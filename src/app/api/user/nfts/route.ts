import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nfts = await prisma.nft.findMany({
    where: { ownerId: user.id },
    include: {
      collection: { select: { name: true, slug: true } },
      listing: { select: { id: true, price: true, currency: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ nfts });
}
