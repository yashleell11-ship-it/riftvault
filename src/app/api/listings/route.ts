import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDefaultCurrency, normalizeCurrency } from "@/lib/currency";
import { listForSaleSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = listForSaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { nftId, price, currency: rawCurrency } = parsed.data;
    const currency = normalizeCurrency(rawCurrency ?? getDefaultCurrency());

    const nft = await prisma.nft.findUnique({
      where: { id: nftId },
      include: { listing: true },
    });

    if (!nft || nft.ownerId !== user.id) {
      return NextResponse.json({ error: "You do not own this artifact" }, { status: 403 });
    }

    if (nft.status !== "reserved") {
      return NextResponse.json(
        { error: "Only reserved artifacts can be listed. Cancel an active listing first." },
        { status: 409 }
      );
    }

    if (nft.listing?.status === "active") {
      return NextResponse.json({ error: "Already listed for sale" }, { status: 409 });
    }

    const listing = await prisma.$transaction(async (tx) => {
      if (nft.listing) {
        await tx.listing.delete({ where: { id: nft.listing.id } });
      }

      const created = await tx.listing.create({
        data: {
          nftId,
          sellerId: user.id,
          price,
          currency,
          status: "active",
        },
      });

      await tx.nft.update({
        where: { id: nftId },
        data: { status: "listed" },
      });

      return created;
    });

    return NextResponse.json({ success: true, listing });
  } catch (error) {
    console.error("List error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
