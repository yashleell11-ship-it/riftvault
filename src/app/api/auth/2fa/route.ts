import { NextResponse } from "next/server";
import { getSessionUser, generateToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTotpSecret, getTotpUri, verifyTotpCode } from "@/lib/totp";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  return NextResponse.json({ enabled: row?.totpEnabled ?? false });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "setup") {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpEnabled: true },
    });
    if (existing?.totpEnabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 409 });
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return NextResponse.json({
      secret,
      uri: getTotpUri(user.email, secret),
    });
  }

  if (action === "enable") {
    const code = String(body.code ?? "");
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true },
    });
    if (!row?.totpSecret) {
      return NextResponse.json({ error: "Run setup first" }, { status: 400 });
    }
    if (!verifyTotpCode(row.totpSecret, code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    });

    return NextResponse.json({ success: true, enabled: true });
  }

  if (action === "disable") {
    const code = String(body.code ?? "");
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!row?.totpEnabled || !row.totpSecret) {
      return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
    }
    if (!verifyTotpCode(row.totpSecret, code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecret: null },
    });

    return NextResponse.json({ success: true, enabled: false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
