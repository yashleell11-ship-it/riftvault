import { randomBytes } from "crypto";
import { cookies } from "next/headers";

const NONCE_COOKIE = "riftvault_wallet_nonce";

export async function createWalletLinkNonce() {
  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return nonce;
}

export async function consumeWalletLinkNonce(expected: string) {
  const cookieStore = await cookies();
  const nonce = cookieStore.get(NONCE_COOKIE)?.value;
  cookieStore.delete(NONCE_COOKIE);
  return nonce === expected;
}

export function parseLinkMessage(message: string) {
  const addressMatch = message.match(/Address:\s*(0x[a-fA-F0-9]{40})/);
  const nonceMatch = message.match(/Nonce:\s*([a-f0-9]+)/);
  if (!addressMatch || !nonceMatch) return null;
  return {
    address: addressMatch[1]!.toLowerCase(),
    nonce: nonceMatch[1]!,
  };
}
