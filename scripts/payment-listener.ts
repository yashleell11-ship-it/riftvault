/**
 * Local payment listener (requires secrets on disk).
 * Prefer `npm run payments:listen` — uses remote mode when secrets are not local.
 */
import "../src/lib/load-env";
import { uniqueDepositAddressesEnabled } from "../src/lib/env";
import { getListenerPollMs, isUsdtPaymentsEnabled } from "../src/payments/blockchain/config";
import { runPaymentListenerTick } from "../src/payments/listener/runner";

function isListenerEnabled() {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

async function main() {
  if (!isListenerEnabled()) {
    console.error(
      "[payment-listener] Local mode is not configured. Run `npm run payments:env:sync` or use default remote mode:\n" +
        "  vercel login\n" +
        "  npm run payments:listen"
    );
    process.exit(1);
  }

  const pollMs = getListenerPollMs();
  console.log(`[payment-listener] Local mode — polling every ${pollMs}ms`);

  const tick = async () => {
    try {
      const result = await runPaymentListenerTick({ maxBlocks: 12 });
      console.log(
        `[payment-listener] Scanned ${result.scanned} blocks (${result.fromBlock}–${result.toBlock}) — checkout: ${result.matched}, deposits: ${result.depositMatched}`
      );
    } catch (error) {
      console.error("[payment-listener] Tick error:", error);
    }
  };

  await tick();
  setInterval(tick, pollMs);
}

main().catch((error) => {
  console.error("[payment-listener] Fatal:", error);
  process.exit(1);
});
