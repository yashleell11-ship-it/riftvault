import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { issueVerificationEmail } from "@/lib/email-verification";
import { EmailDeliveryError } from "@/lib/email";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  try {
    await issueVerificationEmail(user.id, user.email);
    return NextResponse.json({
      success: true,
      message: `Verification email sent to ${user.email}. Check your inbox and spam folder.`,
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
}
