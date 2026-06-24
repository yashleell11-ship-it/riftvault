import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function issueVerificationEmail(userId: string, email: string) {
  await prisma.verificationToken.deleteMany({
    where: { userId, type: "email_verify" },
  });

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      type: "email_verify",
      expiresAt,
    },
  });

  await sendVerificationEmail(email, token);
}
