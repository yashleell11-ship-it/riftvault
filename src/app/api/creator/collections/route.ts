import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  royaltyBps: z.number().int().min(0).max(1000).default(250),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isCreator) {
    await prisma.user.update({ where: { id: user.id }, data: { isCreator: true } });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const existing = await prisma.collection.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 400 });

  const collection = await prisma.collection.create({ data: { ...parsed.data, creatorId: user.id } });
  return NextResponse.json({ collection }, { status: 201 });
}
