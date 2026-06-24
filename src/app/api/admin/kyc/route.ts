import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pending = await prisma.kycProfile.findMany({
    where: { status: "pending" },
    orderBy: { submittedAt: "asc" },
    include: {
      user: { select: { id: true, email: true, displayName: true, level: true } },
    },
  });

  const recent = await prisma.kycProfile.findMany({
    where: { status: { in: ["approved", "rejected"] } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
    },
  });

  return NextResponse.json({ pending, recent });
}
