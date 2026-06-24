import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isPinataConfigured } from "@/lib/pinata";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ enabled: isPinataConfigured() });
}
