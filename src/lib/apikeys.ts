import { createHash, randomBytes, createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `rv_${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 10);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export async function validateApiKey(key: string): Promise<string | null> {
  const hash = createHash("sha256").update(key).digest("hex");
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hash }, select: { userId: true, id: true } });
  if (!record) return null;
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsed: new Date() } });
  return record.userId;
}

export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

const API_WINDOW_MS = 60_000;
const API_MAX_PER_WINDOW = 60;

export async function checkRateLimit(key: string): Promise<boolean> {
  return rateLimit(key, { max: API_MAX_PER_WINDOW, windowMs: API_WINDOW_MS, failClosed: false });
}
