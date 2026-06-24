import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyMarketplacePurchase } from "@/lib/chain/verify";
import { creditOrderRewards } from "@/lib/orders";
import { z } from "zod";

const buyOnchainSchema = z.object({
  nftId: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = buyOnchainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { nftId, txHash, buyerAddress } = parsed.data;
    const buyer = buyerAddress.toLowerCase();

    if (
      user.walletAddress &&
      user.walletAddress.toLowerCase() !== buyer
    ) {
      return NextResponse.json(
        { error: "Connected wallet does not match your linked purchase wallet" },
        { status: 400 }
      );
    }

    const existing = await prisma.order.findUnique({ where: { txHash } });
    if (existing) {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 409 });
    }

    const nft = await prisma.nft.findUnique({
      where: { id: nftId },
      include: { listing: true },
    });

    if (!nft?.chainListingId || !nft.listing || nft.listing.status !== "active") {
      return NextResponse.json({ error: "No on-chain listing for this artifact" }, { status: 409 });
    }

    if (nft.ownerId === user.id) {
      return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 });
    }

    const listingId = BigInt(nft.chainListingId);
    await verifyMarketplacePurchase(
      txHash as `0x${string}`,
      listingId,
      buyer
    );

    const sellerId = nft.ownerId ?? nft.listing.sellerId;
    const price = nft.listing.price;
    const currency = nft.listing.currency;

    const order = await prisma.$transaction(async (tx) => {
      if (!user.walletAddress) {
        await tx.user.update({
          where: { id: user.id },
          data: { walletAddress: buyer },
        });
      }

      const created = await tx.order.create({
        data: {
          nftId,
          buyerId: user.id,
          sellerId,
          price,
          currency,
          paymentMethod: "onchain",
          txHash,
          status: "completed",
        },
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
          chainListingId: null,
        },
      });

      await creditOrderRewards(tx, created);

      return created;
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("On-chain buy sync error:", error);
    const msg = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
