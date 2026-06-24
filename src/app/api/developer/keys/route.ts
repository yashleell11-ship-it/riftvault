import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/apikeys";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, keyPrefix: true, name: true, lastUsed: true, createdAt: true } });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ name: z.string().min(1).max(60) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const count = await prisma.apiKey.count({ where: { userId: user.id } });
  if (count >= 5) return NextResponse.json({ error: "Maximum 5 API keys per account" }, { status: 400 });

  const { raw, prefix, hash } = generateApiKey();
  await prisma.apiKey.create({ data: { userId: user.id, keyHash: hash, keyPrefix: prefix, name: parsed.data.name } });
  return NextResponse.json({ key: raw, prefix, name: parsed.data.name }, { status: 201 });
}
