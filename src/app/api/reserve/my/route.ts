import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reservations = await prisma.reservation.findMany({
    where: { userId: user.id },
    include: {
      nft: {
        include: {
          collection: { select: { name: true, slug: true } },
          listing: { select: { price: true, currency: true, status: true } },
        },
      },
    },
    orderBy: { reservedAt: "desc" },
  });

  return NextResponse.json({ reservations });
}
