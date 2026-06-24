import { NextResponse } from "next/server";
import { validateApiKey, checkRateLimit } from "@/lib/apikeys";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key");
  if (!key) return NextResponse.json({ error: "API key required (X-API-Key header)" }, { status: 401 });
  if (!await checkRateLimit(key)) return NextResponse.json({ error: "Rate limit exceeded (60 req/min)" }, { status: 429 });

  const userId = await validateApiKey(key);
  if (!userId) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const collections = await prisma.collection.findMany({
    include: { _count: { select: { nfts: true } }, creator: { select: { id: true, displayName: true } } },
    orderBy: { floorPrice: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: collections });
}
