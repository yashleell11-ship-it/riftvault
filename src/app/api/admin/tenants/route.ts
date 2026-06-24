import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().url().optional().nullable(),
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tenants });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const tenant = await prisma.tenant.create({ data: parsed.data });

  await logAudit({
    actorId: admin.id,
    action: "tenant.create",
    targetType: "tenant",
    targetId: tenant.id,
    detail: tenant.slug,
  });

  return NextResponse.json({ tenant });
}
