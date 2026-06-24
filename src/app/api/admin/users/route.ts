import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { displayName: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, email: true, displayName: true, level: true, role: true, frozen: true, emailVerified: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

const patchSchema = z.object({ frozen: z.boolean().optional(), role: z.enum(["user", "admin"]).optional() });

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (id === admin.id) return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: parsed.data });

  await logAudit({
    actorId: admin.id,
    action: "user.update",
    targetType: "user",
    targetId: id,
    detail: JSON.stringify(parsed.data),
  });

  return NextResponse.json({ user });
}
