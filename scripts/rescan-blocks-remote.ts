/**
 * Production rescan via Vercel CLI auth (same as remote listener).
 *
 *   npm run payments:rescan:remote -- --block 106502787 --tx 0x6bc2...
 */
import { requireVercelCliToken } from "../src/lib/vercel-cli-auth";
import { parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";

function resolveAppUrl(): string {
  const explicit = process.env.PAYMENTS_LISTEN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  for (const file of [".env.production.local", ".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    const parsed = parse(fs.readFileSync(filePath, "utf8"));
    const url = parsed.NEXT_PUBLIC_APP_URL?.trim();
    if (url && !url.includes("localhost")) return url.replace(/\/$/, "");
  }

  return process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "") ?? "https://riftvault.xyz";
}

function parseArgs() {
  const args = process.argv.slice(2);
  let fromBlock: number | null = null;
  let toBlock: number | null = null;
  let txHash: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--from" && args[i + 1]) fromBlock = Number(args[++i]);
    else if (arg === "--to" && args[i + 1]) toBlock = Number(args[++i]);
    else if (arg === "--block" && args[i + 1]) {
      fromBlock = Number(args[++i]);
      toBlock = fromBlock;
    } else if (arg === "--tx" && args[i + 1]) txHash = args[++i];
  }

  if (fromBlock == null || toBlock == null || !Number.isFinite(fromBlock) || !Number.isFinite(toBlock)) {
    console.error("Usage: npm run payments:rescan:remote -- --block <n> [--tx <hash>]");
    process.exit(1);
  }

  return { fromBlock, toBlock, txHash };
}

async function main() {
  const token = requireVercelCliToken();
  const appUrl = resolveAppUrl();
  const { fromBlock, toBlock, txHash } = parseArgs();

  console.log(`[rescan:remote] POST ${appUrl}/api/cron/rescan-usdt-payments`);
  console.log(`[rescan:remote] blocks ${fromBlock}–${toBlock}`);

  const res = await fetch(`${appUrl}/api/cron/rescan-usdt-payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fromBlock, toBlock, txHash }),
    signal: AbortSignal.timeout(90_000),
  });

  const raw = await res.text();
  console.log(`[rescan:remote] HTTP ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(raw), null, 2));
  } catch {
    console.log(raw);
  }

  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
