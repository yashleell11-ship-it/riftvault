import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return NextResponse.json({ success: true });
}
