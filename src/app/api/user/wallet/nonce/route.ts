import { NextResponse } from "next/server";
import { createWalletLinkNonce } from "@/lib/wallet-link";

export async function GET() {
  const nonce = await createWalletLinkNonce();
  return NextResponse.json({ nonce });
}
