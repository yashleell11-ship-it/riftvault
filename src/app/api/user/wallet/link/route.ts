import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeWalletLinkNonce, parseLinkMessage } from "@/lib/wallet-link";
import { z } from "zod";

const linkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { address, signature, message } = parsed.data;
    const parsedMsg = parseLinkMessage(message);
    if (!parsedMsg || parsedMsg.address !== address.toLowerCase()) {
      return NextResponse.json({ error: "Invalid link message" }, { status: 400 });
    }

    const nonceValid = await consumeWalletLinkNonce(parsedMsg.nonce);
    if (!nonceValid) {
      return NextResponse.json({ error: "Nonce expired — try again" }, { status: 400 });
    }

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: address.toLowerCase() },
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
    console.error("Wallet link error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
