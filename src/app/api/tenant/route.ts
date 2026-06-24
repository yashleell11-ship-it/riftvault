import { NextResponse } from "next/server";
import { getTenantBranding } from "@/lib/tenant";

export async function GET() {
  const tenant = await getTenantBranding();
  return NextResponse.json({ tenant });
}
