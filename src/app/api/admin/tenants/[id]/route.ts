import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  tagline: z.string().max(200).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    actorId: admin.id,
    action: "tenant.update",
    targetType: "tenant",
    targetId: tenant.id,
    detail: JSON.stringify(parsed.data),
  });

  return NextResponse.json({ tenant });
}

export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const tenant = await prisma.tenant.delete({ where: { id } });

  await logAudit({
    actorId: admin.id,
    action: "tenant.delete",
    targetType: "tenant",
    targetId: tenant.id,
    detail: tenant.slug,
  });

  return NextResponse.json({ success: true });
}
