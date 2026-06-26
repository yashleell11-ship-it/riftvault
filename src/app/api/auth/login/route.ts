import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
  generateToken,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { rateLimitAuth } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    if (!(await rateLimitAuth(request, "login", email))) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.frozen) {
      return NextResponse.json({ error: "Account is frozen" }, { status: 403 });
    }

    if (user.totpEnabled && user.totpSecret) {
      const challengeToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      await prisma.verificationToken.deleteMany({
        where: { userId: user.id, type: "2fa_login" },
      });
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: challengeToken,
          type: "2fa_login",
          expiresAt,
        },
      });

      return NextResponse.json({
        requires2fa: true,
        challengeToken,
        email: user.email,
      });
    }

    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        level: user.level,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
