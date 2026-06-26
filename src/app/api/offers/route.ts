import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendOfferReceivedEmail } from "@/lib/email";

const schema = z.object({
  nftId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("USDT"),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { nftId, amount, currency, expiresInHours } = parsed.data;
  const nft = await prisma.nft.findUnique({ where: { id: nftId }, include: { owner: { select: { id: true, email: true } } } });
  if (!nft) return NextResponse.json({ error: "NFT not found" }, { status: 404 });
  if (!nft.ownerId) return NextResponse.json({ error: "NFT has no owner" }, { status: 400 });
  if (nft.ownerId === user.id) return NextResponse.json({ error: "Cannot offer on your own NFT" }, { status: 400 });
  if (nft.status !== "listed" && nft.status !== "auction") {
    return NextResponse.json({ error: "This NFT is not accepting offers" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);
  const offer = await prisma.offer.create({ data: { nftId, buyerId: user.id, amount, currency, expiresAt, status: "pending" } });

  if (nft.owner) {
    await createNotification(prisma, {
      userId: nft.owner.id, type: "offer", title: "New offer received",
      body: `${user.displayName} made an offer of ${amount} ${currency} on ${nft.name}.`,
      link: `/explore/${nftId}`,
    });
    sendOfferReceivedEmail(nft.owner.email, nft.name, amount, currency, nftId).catch(console.error);
  }
  return NextResponse.json({ offer }, { status: 201 });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const nftId = searchParams.get("nftId");
  if (nftId) {
    const nft = await prisma.nft.findUnique({ where: { id: nftId }, select: { ownerId: true } });
    if (!nft || nft.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const offers = await prisma.offer.findMany({
    where: { ...(nftId ? { nftId } : { buyerId: user.id }), status: "pending" },
    include: { buyer: { select: { id: true, displayName: true } }, nft: { select: { id: true, name: true, imageUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ offers });
}
