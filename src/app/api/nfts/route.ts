import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedCollectionOptions } from "@/lib/collections-cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const collection = searchParams.get("collection") ?? "";
  const status = searchParams.get("status") ?? "";
  const rarity = searchParams.get("rarity") ?? "";
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(24, parseInt(searchParams.get("limit") ?? "12", 10));
  const skip = (page - 1) * limit;

  const where: {
    name?: { contains: string };
    status?: string;
    rarity?: string;
    collection?: { slug: string };
    listing?: { price?: { gte?: number; lte?: number }; status: string };
  } = {};

  if (search) {
    where.name = { contains: search };
  }
  if (status) {
    where.status = status;
  }
  if (rarity) {
    where.rarity = rarity;
  }
  if (collection) {
    where.collection = { slug: collection };
  }
  if (minPrice || maxPrice) {
    where.listing = {
      status: "active",
      price: {
        ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
        ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
      },
    };
  }

  const orderBy =
    sort === "price_asc"
      ? { listing: { price: "asc" as const } }
      : sort === "price_desc"
        ? { listing: { price: "desc" as const } }
        : { createdAt: "desc" as const };

  const [nfts, total, collections] = await Promise.all([
    prisma.nft.findMany({
      where,
      include: {
        collection: { select: { name: true, slug: true } },
        listing: { select: { price: true, currency: true, status: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.nft.count({ where }),
    getCachedCollectionOptions(),
  ]);

  return NextResponse.json({
    nfts,
    collections,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
