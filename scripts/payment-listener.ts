/**
 * Self-hosted USDT BEP20 payment listener.
 * Run alongside the Next.js app for continuous blockchain monitoring.
 *
 * Usage: npm run payments:listen
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
      "[payment-listener] Configure RECEIVING_WALLET + BSC_RPC_URL for checkout, or ENABLE_UNIQUE_DEPOSIT_ADDRESSES + DEPOSIT_MNEMONIC for wallet deposits."
    );
    process.exit(1);
  }

  const pollMs = getListenerPollMs();
  console.log(`[payment-listener] Started — polling every ${pollMs}ms`);

  const tick = async () => {
    try {
      const result = await runPaymentListenerTick({ maxBlocks: 500 });
      if (result.matched > 0 || result.depositMatched > 0) {
        console.log(
          `[payment-listener] Scanned ${result.scanned} blocks — checkout: ${result.matched}, deposits: ${result.depositMatched}`
        );
      }
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
