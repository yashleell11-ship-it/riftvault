import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { issueVerificationEmail } from "@/lib/email-verification";
import { EmailDeliveryError } from "@/lib/email";
import { signupSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { displayName, email, password, referralCode } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      });
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        displayName,
        email,
        passwordHash,
        referredById,
      },
    });

    try {
      await issueVerificationEmail(user.id, email);
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } });
      if (error instanceof EmailDeliveryError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
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
      message: "Account created. Check your email to verify.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
