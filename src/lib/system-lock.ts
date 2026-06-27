import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Portable cross-process mutex backed by the SystemLock table.
 *
 * Works on both SQLite (dev) and Postgres (prod) and, unlike a Postgres
 * session advisory lock, does not depend on connection affinity — safe under
 * serverless connection pooling. A lease has an `expiresAt`; a crashed holder's
 * stale lease can be stolen, so the lock never deadlocks permanently.
 */

export type LockHandle = {
  key: string;
  owner: string;
};

/** Try to acquire `key`. Returns a handle if acquired, or null if held by a live owner. */
export async function acquireLock(
  key: string,
  ttlMs: number
): Promise<LockHandle | null> {
  const owner = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Fast path: create the row if it does not exist yet.
  try {
    await prisma.systemLock.create({ data: { key, owner, expiresAt } });
    return { key, owner };
  } catch {
    // Row already exists — fall through to the steal-if-stale path.
  }

  // Steal the lease only if the current one has expired. The `expiresAt < now`
  // guard in the WHERE clause makes this atomic: at most one racer's updateMany
  // matches, the rest see count === 0.
  const stolen = await prisma.systemLock.updateMany({
    where: { key, expiresAt: { lt: now } },
    data: { owner, acquiredAt: now, expiresAt },
  });
  if (stolen.count === 1) return { key, owner };

  return null;
}

/** Extend a held lease (call periodically during long work). No-op if lost. */
export async function renewLock(handle: LockHandle, ttlMs: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const renewed = await prisma.systemLock.updateMany({
    where: { key: handle.key, owner: handle.owner },
    data: { expiresAt },
  });
  return renewed.count === 1;
}

/** Release a held lock. Only the owner can release (idempotent otherwise). */
export async function releaseLock(handle: LockHandle): Promise<void> {
  await prisma.systemLock
    .deleteMany({ where: { key: handle.key, owner: handle.owner } })
    .catch(() => {
      /* best-effort: a stolen/expired lock may already be gone */
    });
}

/**
 * Run `fn` while holding `key`. If the lock is already held by a live owner,
 * `fn` is skipped and `{ ran: false }` is returned. The lease auto-renews on a
 * heartbeat so long jobs keep it, and is always released in `finally`.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<{ ran: true; result: T } | { ran: false }> {
  const handle = await acquireLock(key, ttlMs);
  if (!handle) return { ran: false };

  const heartbeat = setInterval(() => {
    void renewLock(handle, ttlMs);
  }, Math.max(5_000, Math.floor(ttlMs / 2)));
  // Don't keep the event loop alive on the heartbeat alone.
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    clearInterval(heartbeat);
    await releaseLock(handle);
  }
}

export const SWEEPER_LOCK_KEY = "treasury-sweeper";
