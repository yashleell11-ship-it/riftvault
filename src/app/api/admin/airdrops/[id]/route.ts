import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  maxClaims: z.number().int().positive().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const campaign = await prisma.airdropCampaign.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ campaign });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.airdropCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
