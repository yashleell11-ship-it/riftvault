import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  tokenAmount: z.number().positive(),
  currency: z.string().default("USDT"),
  minLevel: z.number().int().min(1).max(5).default(1),
  requiresEmailVerified: z.boolean().default(true),
  maxClaims: z.number().int().positive().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const campaigns = await prisma.airdropCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { claims: true } } },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { startsAt, endsAt, ...rest } = parsed.data;
  const campaign = await prisma.airdropCampaign.create({
    data: { ...rest, startsAt: new Date(startsAt), endsAt: endsAt ? new Date(endsAt) : null },
  });
  return NextResponse.json({ campaign }, { status: 201 });
}
