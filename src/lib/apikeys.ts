import { createHash, randomBytes, createHmac } from "crypto";
import { prisma } from "@/lib/db";

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

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Uses Upstash Redis REST API when UPSTASH_REDIS_REST_URL + TOKEN are set.
// Falls back to a local in-memory map (resets on restart — fine for dev).
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

// In-memory fallback
const localMap = new Map<string, { count: number; resetAt: number }>();

function localCheck(key: string): boolean {
  const now = Date.now();
  const entry = localMap.get(key);
  if (!entry || now > entry.resetAt) {
    localMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

async function upstashCheck(key: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;
  const windowSec = Math.ceil(WINDOW_MS / 1000);

  // INCR + EXPIRE in a pipeline (two-command pipeline via Upstash REST)
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec, "NX"],
    ]),
  });

  if (!res.ok) {
    // Redis unreachable — fail open (allow request, log warning)
    console.warn("[RateLimit] Upstash unavailable, failing open");
    return true;
  }

  const data = (await res.json()) as [{ result: number }, unknown];
  const count = data[0]?.result ?? 1;
  return count <= MAX_PER_WINDOW;
}

export async function checkRateLimit(key: string): Promise<boolean> {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  if (hasUpstash) {
    return upstashCheck(key);
  }
  return localCheck(key);
}
