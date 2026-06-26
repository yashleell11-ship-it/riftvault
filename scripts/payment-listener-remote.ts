import { parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { requireVercelCliToken } from "../src/lib/vercel-cli-auth";

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

async function triggerScan(appUrl: string, token: string) {
  const res = await fetch(`${appUrl}/api/cron/scan-usdt-payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  const token = requireVercelCliToken();
  const appUrl = resolveAppUrl();
  const pollMs = getPollMs();

  console.log(`[payment-listener] Remote mode — ${appUrl}`);
  console.log(`[payment-listener] Polling every ${pollMs}ms (production holds secrets)`);

  const tick = async () => {
    try {
      const { res, data } = await triggerScan(appUrl, token);

      if (res.status === 401) {
        console.error(
          "[payment-listener] Unauthorized — deploy the latest app (Vercel CLI cron auth) or set CRON_SECRET locally."
        );
        return;
      }

      if (!res.ok) {
        console.error("[payment-listener] Scan request failed:", res.status, data);
        return;
      }

      if (data.skipped) {
        console.warn("[payment-listener] Skipped on server:", data.reason ?? "not_configured");
        return;
      }

      if ((data.matched ?? 0) > 0 || (data.depositMatched ?? 0) > 0) {
        console.log(
          `[payment-listener] Scan ok — checkout: ${data.matched ?? 0}, deposits: ${data.depositMatched ?? 0}`
        );
      }
    } catch (error) {
      console.error("[payment-listener] Request error:", error);
    }
  };

  await tick();
  setInterval(tick, pollMs);
}

main().catch((error) => {
  console.error("[payment-listener] Fatal:", error);
  process.exit(1);
});
