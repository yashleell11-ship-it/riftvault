import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const nftSchema = z.object({
  tokenId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url(),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]).default("common"),
});

const batchSchema = z.object({
  collectionId: z.string().min(1),
  nfts: z.array(nftSchema).min(1).max(50),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const collection = await prisma.collection.findUnique({ where: { id: parsed.data.collectionId, creatorId: user.id } });
  if (!collection) return NextResponse.json({ error: "Collection not found or not owned by you" }, { status: 404 });

  const created = await prisma.$transaction(
    parsed.data.nfts.map(nft =>
      prisma.nft.create({ data: { ...nft, collectionId: parsed.data.collectionId, ownerId: user.id, status: "available" } })
    )
  );
  return NextResponse.json({ created: created.length, nfts: created }, { status: 201 });
}
