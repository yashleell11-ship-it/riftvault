/**
 * IP / key rate limiting — Upstash Redis when configured, in-memory fallback for dev.
 * Auth-sensitive routes use failClosed when Redis is configured but unreachable.
 */

import { pruneStaleEntries } from "@/lib/scan-throttle";

const localMap = new Map<string, { count: number; resetAt: number }>();

export type RateLimitOptions = {
  max: number;
  windowMs: number;
  /** When true and Upstash is configured but down, deny the request */
  failClosed?: boolean;
};

function localCheck(key: string, max: number, windowMs: number): boolean {
  pruneStaleEntries(localMap);
  const now = Date.now();
  const entry = localMap.get(key);
  if (!entry || now > entry.resetAt) {
    localMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

async function upstashCheck(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rl:${key}`;
  const windowSec = Math.ceil(windowMs / 1000);

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec, "NX"],
    ]),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as [{ result: number }, unknown];
  const count = data[0]?.result ?? 1;
  return count <= max;
}

export async function rateLimit(key: string, options: RateLimitOptions): Promise<boolean> {
  const { max, windowMs, failClosed = false } = options;
  const redisResult = await upstashCheck(key, max, windowMs);

  if (redisResult === null) {
    if (
      failClosed &&
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      console.warn("[RateLimit] Upstash unavailable, failing closed for:", key);
      return false;
    }
    return localCheck(key, max, windowMs);
  }

  return redisResult;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Stricter limits for authentication endpoints */
export async function rateLimitAuth(
  request: Request,
  bucket: string,
  identifier?: string
): Promise<boolean> {
  const ip = getClientIp(request);
  const key = `${bucket}:${ip}${identifier ? `:${identifier}` : ""}`;
  const limits: Record<string, RateLimitOptions> = {
    login: { max: 10, windowMs: 15 * 60_000, failClosed: true },
    signup: { max: 5, windowMs: 60 * 60_000, failClosed: true },
    forgot_password: { max: 3, windowMs: 60 * 60_000, failClosed: true },
    reset_password: { max: 10, windowMs: 60 * 60_000, failClosed: true },
    verify_2fa: { max: 5, windowMs: 5 * 60_000, failClosed: true },
    resend_verification: { max: 3, windowMs: 15 * 60_000, failClosed: true },
  };
  const opts = limits[bucket] ?? { max: 10, windowMs: 60_000, failClosed: true };
  return rateLimit(`auth:${key}`, opts);
}
