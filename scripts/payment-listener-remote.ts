import { parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { requireVercelCliToken } from "../src/lib/vercel-cli-auth";

const FETCH_TIMEOUT_MS = 30_000;

function resolveAppUrl(): string {
  const explicit = process.env.PAYMENTS_LISTEN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const pullFiles = [".env.production.local", ".env.local", ".env"];
  for (const file of pullFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    const parsed = parse(fs.readFileSync(filePath, "utf8"));
    const url = parsed.NEXT_PUBLIC_APP_URL?.trim();
    if (url && !url.includes("localhost") && !url.includes("127.0.0.1")) {
      return url.replace(/\/$/, "");
    }
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv.replace(/\/$/, "");
  }

  return "https://riftvault.xyz";
}

function getPollMs(): number {
  const n = Number(process.env.PAYMENT_LISTENER_POLL_MS ?? 15_000);
  return Number.isFinite(n) && n >= 3_000 ? Math.floor(n) : 15_000;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

type ScanResponse = {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  scanned?: number;
  matched?: number;
  depositMatched?: number;
  latestBlock?: string | number;
  details?: { name?: string; message?: string };
};

async function triggerScan(appUrl: string, token: string, pollId: number) {
  const url = `${appUrl}/api/cron/scan-usdt-payments`;
  const started = Date.now();

  console.log(`[payment-listener] poll #${pollId} → POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const elapsed = Date.now() - started;
  console.log(
    `[payment-listener] poll #${pollId} ← HTTP ${res.status} ${res.statusText || ""} (${elapsed}ms)`.trim()
  );

  const raw = await res.text();
  let data: ScanResponse = {};

  if (raw) {
    try {
      data = JSON.parse(raw) as ScanResponse;
    } catch {
      console.error(
        `[payment-listener] poll #${pollId} failed to parse JSON body (${raw.length} bytes):`,
        raw.slice(0, 2000)
      );
    }
  }

  if (!res.ok) {
    console.error(`[payment-listener] poll #${pollId} response body:`, raw.slice(0, 2000) || data);
    const detail = data.details?.message ?? data.details?.name ?? data.error;
    if (detail) {
      console.error(`[payment-listener] poll #${pollId} error detail:`, detail);
    }
  }

  return { res, data, elapsed };
}

function logScanSuccess(pollId: number, data: ScanResponse, elapsed: number) {
  console.log(
    [
      `[payment-listener] poll #${pollId} ok`,
      `scanned=${data.scanned ?? 0}`,
      `matched=${data.matched ?? 0}`,
      `depositMatched=${data.depositMatched ?? 0}`,
      `latestBlock=${data.latestBlock ?? "?"}`,
      `executionTime=${elapsed}ms`,
    ].join(" ")
  );
}

async function main() {
  const token = requireVercelCliToken();
  const appUrl = resolveAppUrl();
  const pollMs = getPollMs();
  let pollId = 0;

  console.log(`[payment-listener] Remote mode — ${appUrl}`);
  console.log(
    `[payment-listener] Polling every ${pollMs}ms (fetch timeout ${FETCH_TIMEOUT_MS}ms, production holds secrets)`
  );

  const tick = async () => {
    pollId += 1;
    const id = pollId;

    try {
      const { res, data, elapsed } = await triggerScan(appUrl, token, id);

      if (res.status === 401) {
        console.error(
          `[payment-listener] poll #${id} unauthorized — run \`vercel login\` or deploy latest cron auth`
        );
        return;
      }

      if (!res.ok) {
        console.error(`[payment-listener] poll #${id} scan failed (HTTP ${res.status})`);
        return;
      }

      if (data.skipped) {
        console.warn(
          `[payment-listener] poll #${id} skipped on server: ${data.reason ?? "not_configured"} (${elapsed}ms)`
        );
        return;
      }

      logScanSuccess(id, data, elapsed);
    } catch (error) {
      const label =
        error instanceof Error && error.name === "TimeoutError"
          ? `timeout after ${FETCH_TIMEOUT_MS}ms`
          : "request error";
      console.error(`[payment-listener] poll #${id} ${label}:\n${formatError(error)}`);
    }
  };

  for (;;) {
    const started = Date.now();
    await tick();
    const wait = Math.max(0, pollMs - (Date.now() - started));
    if (wait > 0) {
      await sleep(wait);
    }
  }
}

main().catch((error) => {
  console.error("[payment-listener] Fatal:\n", formatError(error));
  process.exit(1);
});
