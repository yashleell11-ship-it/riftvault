import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
    include: {
      nft: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          collection: { select: { name: true } },
        },
      },
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
