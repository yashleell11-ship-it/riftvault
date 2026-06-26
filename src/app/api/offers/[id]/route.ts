import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { creditOrderRewards, settleOrderPayment } from "@/lib/orders";
import { getWalletBalance } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";

const schema = z.object({ action: z.enum(["accept", "reject"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { nft: { include: { listing: true } }, buyer: { select: { id: true, displayName: true } } },
  });
  if (!offer || offer.status !== "pending") {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (offer.nft.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (offer.expiresAt < new Date()) {
    return NextResponse.json({ error: "Offer expired" }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await prisma.offer.update({ where: { id }, data: { status: "rejected" } });
    await createNotification(prisma, {
      userId: offer.buyerId,
      type: "offer_rejected",
      title: "Offer declined",
      body: `Your offer on ${offer.nft.name} was declined.`,
      link: `/explore/${offer.nftId}`,
    });
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const nft = await tx.nft.findUnique({
        where: { id: offer.nftId },
        include: { listing: true },
      });
      if (!nft || nft.ownerId !== user.id) {
        throw new Error("NFT_NO_LONGER_OWNED");
      }

      const activeAuction = await tx.auction.findFirst({
        where: { nftId: offer.nftId, status: "active" },
      });
      if (activeAuction) {
        throw new Error("AUCTION_ACTIVE");
      }

      const listed =
        nft.status === "listed" &&
        nft.listing &&
        nft.listing.status === "active";

      if (!listed && nft.status !== "auction") {
        throw new Error("NOT_FOR_SALE");
      }

      if (listed && nft.listing) {
        const claimed = await tx.listing.updateMany({
          where: { id: nft.listing.id, status: "active" },
          data: { status: "sold" },
        });
        if (claimed.count === 0) throw new Error("NOT_FOR_SALE");
      }

      const currency = normalizeCurrency(offer.currency);
      const buyerBal = await getWalletBalance(tx, offer.buyerId, currency);
      if (buyerBal < offer.amount) throw new Error("INSUFFICIENT_BALANCE");

      const order = await tx.order.create({
        data: {
          nftId: offer.nft.id,
          buyerId: offer.buyerId,
          sellerId: user.id,
          price: offer.amount,
          currency,
          status: "completed",
        },
      });

      await settleOrderPayment(tx, {
        id: order.id,
        buyerId: offer.buyerId,
        sellerId: user.id,
        price: offer.amount,
        currency,
        nftName: offer.nft.name,
      });

      await tx.nft.update({
        where: { id: offer.nft.id },
        data: { ownerId: offer.buyerId, status: "reserved" },
      });

      await tx.listing.updateMany({
        where: { nftId: offer.nft.id, status: { not: "sold" } },
        data: { status: "cancelled" },
      });

      await tx.offer.update({ where: { id }, data: { status: "accepted" } });
      await tx.offer.updateMany({
        where: { nftId: offer.nftId, status: "pending", id: { not: id } },
        data: { status: "rejected" },
      });

      await creditOrderRewards(tx, order);
    });

    await createNotification(prisma, {
      userId: offer.buyerId,
      type: "offer_accepted",
      title: "Offer accepted!",
      body: `Your offer of ${offer.amount} ${offer.currency} on ${offer.nft.name} was accepted.`,
      link: `/explore/${offer.nftId}`,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json({ error: "Buyer has insufficient balance" }, { status: 409 });
      }
      if (error.message === "NOT_FOR_SALE" || error.message === "NFT_NO_LONGER_OWNED") {
        return NextResponse.json({ error: "This NFT is no longer for sale" }, { status: 409 });
      }
      if (error.message === "AUCTION_ACTIVE") {
        return NextResponse.json({ error: "End the auction before accepting offers" }, { status: 409 });
      }
    }
    console.error("Offer accept error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
