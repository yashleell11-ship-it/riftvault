import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { getWalletBalance, debitWallet, creditWallet } from "@/lib/wallet";
import { normalizeCurrency } from "@/lib/currency";

const schema = z.object({ action: z.enum(["accept", "reject"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const offer = await prisma.offer.findUnique({ where: { id }, include: { nft: true, buyer: { select: { id: true, displayName: true } } } });
  if (!offer || offer.status !== "pending") return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.nft.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (offer.expiresAt < new Date()) return NextResponse.json({ error: "Offer expired" }, { status: 400 });

  if (parsed.data.action === "accept") {
    await prisma.$transaction(async (tx) => {
      const currency = normalizeCurrency(offer.currency);
      const buyerBal = await getWalletBalance(tx, offer.buyerId, currency);
      if (buyerBal < offer.amount) throw new Error("Buyer has insufficient balance");

      await debitWallet(tx, { userId: offer.buyerId, amount: offer.amount, currency, type: "purchase", description: `Offer accepted: ${offer.nft.name}` });
      await creditWallet(tx, { userId: user.id, amount: offer.amount, currency, type: "sale", description: `Offer accepted: ${offer.nft.name}` });
      await tx.nft.update({ where: { id: offer.nft.id }, data: { ownerId: offer.buyerId, status: "available" } });
      await tx.listing.deleteMany({ where: { nftId: offer.nft.id } });
      await tx.offer.update({ where: { id }, data: { status: "accepted" } });
      await tx.offer.updateMany({ where: { nftId: offer.nftId, status: "pending", id: { not: id } }, data: { status: "rejected" } });
      await tx.order.create({ data: { nftId: offer.nft.id, buyerId: offer.buyerId, sellerId: user.id, price: offer.amount, currency, status: "completed" } });
    });
    await createNotification(prisma, { userId: offer.buyerId, type: "offer_accepted", title: "Offer accepted!", body: `Your offer of ${offer.amount} ${offer.currency} on ${offer.nft.name} was accepted.`, link: `/explore/${offer.nftId}` });
  } else {
    await prisma.offer.update({ where: { id }, data: { status: "rejected" } });
    await createNotification(prisma, { userId: offer.buyerId, type: "offer_rejected", title: "Offer declined", body: `Your offer on ${offer.nft.name} was declined.`, link: `/explore/${offer.nftId}` });
  }
  return NextResponse.json({ success: true });
}
