import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  tier: z.number().int().min(0).max(2).optional(),
});

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const tier =
    parsed.data.status === "approved" ? (parsed.data.tier ?? 1) : 0;

  const profile = await prisma.kycProfile.upsert({
    where: { userId },
    create: {
      userId,
      status: parsed.data.status,
      tier,
      reviewedAt: new Date(),
    },
    update: {
      status: parsed.data.status,
      tier,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    actorId: admin.id,
    action: "kyc.review",
    targetType: "user",
    targetId: userId,
    detail: `${parsed.data.status} tier ${tier}`,
  });

  return NextResponse.json({ profile });
}
