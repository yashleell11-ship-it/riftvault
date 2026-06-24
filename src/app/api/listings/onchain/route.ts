import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  nftId: z.string().min(1),
  chainListingId: z.string().min(1),
  chainTokenId: z.string().optional(),
  txHash: z.string().optional(),
  priceEth: z.number().positive(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { nftId, chainListingId, chainTokenId, priceEth } = parsed.data;

  const nft = await prisma.nft.findUnique({ where: { id: nftId } });
  if (!nft || nft.ownerId !== user.id) return NextResponse.json({ error: "Not found or not your NFT" }, { status: 403 });

  // Update chainListingId + chainTokenId, mark as listed
  await prisma.$transaction([
    prisma.nft.update({
      where: { id: nftId },
      data: { chainListingId, chainTokenId: chainTokenId ?? nft.chainTokenId, status: "listed" },
    }),
    prisma.listing.upsert({
      where: { nftId },
      create: { nftId, sellerId: user.id, price: priceEth, currency: "ETH", status: "active" },
      update: { price: priceEth, currency: "ETH", status: "active" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
