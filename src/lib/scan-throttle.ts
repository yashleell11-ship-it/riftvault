/** In-memory throttle for expensive blockchain scan ticks (per serverless instance). */
const lastRun = new Map<string, number>();

export function shouldRunThrottledScan(key: string, intervalMs: number): boolean {
  const now = Date.now();
  const last = lastRun.get(key) ?? 0;
  if (now - last < intervalMs) return false;
  lastRun.set(key, now);
  return true;
}

/** Drop expired rate-limit entries to avoid unbounded Map growth. */
export function pruneStaleEntries(
  map: Map<string, { count: number; resetAt: number }>,
  maxSize = 10_000
) {
  const now = Date.now();
  for (const [key, entry] of map) {
    if (entry.resetAt < now) map.delete(key);
  }
  if (map.size <= maxSize) return;
  const overflow = map.size - maxSize;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    if (++removed >= overflow) break;
  }
}
