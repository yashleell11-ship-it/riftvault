import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimitAuth } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if (!(await rateLimitAuth(request, "forgot_password", parsed.data.email))) {
      return NextResponse.json({
        success: true,
        message: "If that email is registered, you will receive a reset link shortly.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (user) {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token,
          type: "password_reset",
          expiresAt,
        },
      });

      await sendPasswordResetEmail(user.email, token);
    }

    return NextResponse.json({
      message: "If that email exists, a reset link was sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
