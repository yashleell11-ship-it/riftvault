import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buyNftSchema } from "@/lib/validations";
import {
  creditOrderRewards,
  getWalletBalance,
  settleOrderPayment,
} from "@/lib/orders";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = buyNftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { nftId } = parsed.data;

    const nft = await prisma.nft.findUnique({
      where: { id: nftId },
      include: { listing: true },
    });

    if (!nft?.listing || nft.listing.status !== "active" || nft.status !== "listed") {
      return NextResponse.json({ error: "This artifact is not for sale" }, { status: 409 });
    }

    if (nft.ownerId === user.id) {
      return NextResponse.json({ error: "You cannot buy your own listing" }, { status: 400 });
    }

    const sellerId = nft.ownerId ?? nft.listing.sellerId;
    const price = nft.listing.price;
    const currency = nft.listing.currency;

    const balance = await getWalletBalance(prisma, user.id, currency);
    if (balance < price) {
      return NextResponse.json(
        {
          error: "Insufficient wallet balance. Deposit funds in your dashboard wallet first.",
          balance,
          required: price,
          currency,
        },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          nftId,
          buyerId: user.id,
          sellerId,
          price,
          currency,
          status: "completed",
        },
      });

      await settleOrderPayment(tx, {
        id: created.id,
        buyerId: user.id,
        sellerId,
        price,
        currency,
        nftName: nft.name,
      });

      await tx.listing.update({
        where: { id: nft.listing!.id },
        data: { status: "sold" },
      });

      await tx.nft.update({
        where: { id: nftId },
        data: {
          ownerId: user.id,
          status: "reserved",
        },
      });

      await creditOrderRewards(tx, created);

      return created;
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient balance") {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }
    console.error("Buy error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
