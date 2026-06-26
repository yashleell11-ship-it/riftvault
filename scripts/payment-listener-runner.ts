import { hasVercelCliCredentials } from "../src/lib/cron-auth";
import { isUsdtPaymentsEnabled } from "../src/payments/blockchain/config";
import { uniqueDepositAddressesEnabled } from "../src/lib/env";

function localListenerConfigured(): boolean {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

async function main() {
  const mode = process.env.PAYMENTS_LISTEN_MODE?.trim().toLowerCase();

  if (mode === "local") {
    await import("./payment-listener");
    return;
  }

  if (mode === "remote") {
    if (!hasVercelCliCredentials()) {
      console.error("[payment-listener] Remote mode requires `vercel login`.");
      process.exit(1);
    }
    await import("./payment-listener-remote");
    return;
  }

  if (localListenerConfigured()) {
    await import("./payment-listener");
    return;
  }

  if (!hasVercelCliCredentials()) {
    console.error(
      "[payment-listener] Vercel sensitive secrets cannot be downloaded to disk.\n" +
        "Run `vercel login` once, then `npm run payments:listen` again (remote mode).\n" +
        "Optional local mode: `npm run payments:env:sync` then PAYMENTS_LISTEN_MODE=local npm run payments:listen"
    );
    process.exit(1);
  }

  console.log(
    "[payment-listener] Remote mode — production scans via Vercel CLI auth (no secrets file)."
  );
  await import("./payment-listener-remote");
}

main().catch((error) => {
  console.error("[payment-listener] Fatal:", error);
  process.exit(1);
});
