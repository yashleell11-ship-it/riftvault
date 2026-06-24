import { NextResponse } from "next/server";
import { validateApiKey, checkRateLimit } from "@/lib/apikeys";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key");
  if (!key) return NextResponse.json({ error: "API key required (X-API-Key header)" }, { status: 401 });
  if (!await checkRateLimit(key)) return NextResponse.json({ error: "Rate limit exceeded (60 req/min)" }, { status: 429 });

  const userId = await validateApiKey(key);
  if (!userId) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const collection = searchParams.get("collection");
  const rarity = searchParams.get("rarity");

  const nfts = await prisma.nft.findMany({
    where: { status: "listed", ...(collection ? { collection: { slug: collection } } : {}), ...(rarity ? { rarity } : {}) },
    include: { collection: { select: { name: true, slug: true } }, listing: { select: { price: true, currency: true } } },
    take: limit, skip: offset, orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: nfts, limit, offset, count: nfts.length });
}
