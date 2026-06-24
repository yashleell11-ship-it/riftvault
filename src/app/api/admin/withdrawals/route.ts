import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const withdrawals = await prisma.walletTransaction.findMany({
    where: { type: "withdraw", status: "pending" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          withdrawWalletAddress: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ withdrawals });
}
