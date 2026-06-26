import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyTotpCode } from "@/lib/totp";
import { rateLimitAuth } from "@/lib/rate-limit";

const schema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { challengeToken, code } = parsed.data;

    if (!(await rateLimitAuth(request, "verify_2fa", challengeToken))) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const token = await prisma.verificationToken.findUnique({
      where: { token: challengeToken },
      include: { user: true },
    });

    if (
      !token ||
      token.type !== "2fa_login" ||
      token.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 401 });
    }

    if (token.user.frozen) {
      await prisma.verificationToken.delete({ where: { id: token.id } });
      return NextResponse.json({ error: "Account is frozen" }, { status: 403 });
    }

    if (!token.user.totpEnabled || !token.user.totpSecret) {
      return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
    }

    if (!verifyTotpCode(token.user.totpSecret, code)) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    await prisma.verificationToken.delete({ where: { id: token.id } });

    const session = await createSession(token.userId);
    await setSessionCookie(session.token, session.expiresAt);

    return NextResponse.json({
      user: {
        id: token.user.id,
        email: token.user.email,
        displayName: token.user.displayName,
        level: token.user.level,
      },
    });
  } catch (error) {
    console.error("2FA verify login error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
