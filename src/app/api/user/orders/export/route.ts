import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") !== "csv") return NextResponse.json({ error: "Unsupported format" }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    include: { nft: { select: { name: true, collection: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    ["Date", "NFT", "Collection", "Role", "Price", "Currency", "Status"],
    ...orders.map(o => [
      new Date(o.createdAt).toISOString(),
      o.nft.name,
      o.nft.collection.name,
      o.buyerId === user.id ? "buyer" : "seller",
      o.price.toString(),
      o.currency,
      o.status,
    ]),
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="riftvault-orders-${Date.now()}.csv"`,
    },
  });
}
