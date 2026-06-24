import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        displayName: true,
        level: true,
        referralCode: true,
        walletAddress: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
