import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)))
  );
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.earning.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            price: true,
            nft: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                collection: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.earning.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
