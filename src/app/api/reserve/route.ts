import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReserveDayKey, getMaxReserveSlots } from "@/lib/reserve";
import { reserveNftSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = reserveNftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { nftId } = parsed.data;
    const dayKey = getReserveDayKey();
    const maxSlots = getMaxReserveSlots(user.level);

    const usedToday = await prisma.reservation.count({
      where: { userId: user.id, dayKey },
    });

    if (usedToday >= maxSlots) {
      return NextResponse.json(
        { error: `Daily limit reached (${maxSlots} slot${maxSlots > 1 ? "s" : ""} for ${user.level ? `LV${user.level}` : "your level"})` },
        { status: 429 }
      );
    }

    const nft = await prisma.nft.findUnique({
      where: { id: nftId },
      include: { listing: true },
    });

    if (!nft || nft.status !== "available" || nft.ownerId || nft.listing) {
      return NextResponse.json(
        { error: "This artifact is no longer available to reserve" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          userId: user.id,
          nftId,
          dayKey,
        },
      });

      const updatedNft = await tx.nft.update({
        where: { id: nftId },
        data: {
          ownerId: user.id,
          status: "reserved",
        },
        include: {
          collection: { select: { name: true, slug: true } },
        },
      });

      return { reservation, nft: updatedNft };
    });

    return NextResponse.json({
      success: true,
      reservation: result.reservation,
      nft: result.nft,
      remaining: maxSlots - usedToday - 1,
    });
  } catch (error) {
    console.error("Reserve error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
