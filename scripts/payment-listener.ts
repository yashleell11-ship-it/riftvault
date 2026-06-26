/**
 * Self-hosted USDT BEP20 payment listener.
 * Run alongside the Next.js app for continuous blockchain monitoring.
 *
 * Usage: npm run payments:listen
 *
 * Local secrets: Vercel encrypts production env vars — `vercel env pull` leaves
 * them empty on disk. Copy values into `.env.payments.local` (see docs/USDT_PAYMENTS.md).
 */
import "../src/lib/load-env";
import { listenerOverridePath } from "../src/lib/load-env";

import { uniqueDepositAddressesEnabled } from "../src/lib/env";
import { getBscRpcUrl, getListenerPollMs, getReceivingWallet, isUsdtPaymentsEnabled } from "../src/payments/blockchain/config";
import { isDepositDerivationConfigured, isEnvFlagEnabled } from "../src/deposits/blockchain/config";
import { runPaymentListenerTick } from "../src/payments/listener/runner";

function isListenerEnabled() {
  return isUsdtPaymentsEnabled() || uniqueDepositAddressesEnabled();
}

function envStatus(name: string) {
  const value = process.env[name];
  if (value === undefined) return "missing";
  if (value === "") return "empty (Vercel pull placeholder?)";
  return "set";
}

function printConfigHelp() {
  const usdt = isUsdtPaymentsEnabled();
  const deposits = uniqueDepositAddressesEnabled();

  console.error("[payment-listener] Missing configuration — cannot start.\n");
  console.error("Checked environment:");
  console.error(`  RECEIVING_WALLET: ${envStatus("RECEIVING_WALLET")}${getReceivingWallet() ? " (valid)" : ""}`);
  console.error(`  BSC_RPC_URL: ${envStatus("BSC_RPC_URL")}${getBscRpcUrl() ? " (valid)" : ""}`);
  console.error(`  ENABLE_UNIQUE_DEPOSIT_ADDRESSES: ${envStatus("ENABLE_UNIQUE_DEPOSIT_ADDRESSES")} (enabled=${isEnvFlagEnabled("ENABLE_UNIQUE_DEPOSIT_ADDRESSES")})`);
  console.error(`  DEPOSIT_MNEMONIC: ${envStatus("DEPOSIT_MNEMONIC")} (configured=${isDepositDerivationConfigured()})`);
  console.error(`  USDT checkout listener: ${usdt ? "ready" : "not configured"}`);
  console.error(`  Wallet deposit listener: ${deposits ? "ready" : "not configured"}`);
  console.error("");
  console.error(
    "Vercel encrypts production secrets — `vercel env pull` cannot download them as plaintext."
  );
  console.error("For local listener, create a gitignored override file with real values:");
  console.error(`  ${listenerOverridePath()}`);
  console.error("");
  console.error("Example:");
  console.error('  RECEIVING_WALLET="0xYourWallet..."');
  console.error('  BSC_RPC_URL="https://bsc-dataseed.binance.org"');
  console.error('  ENABLE_UNIQUE_DEPOSIT_ADDRESSES="true"');
  console.error('  DEPOSIT_MNEMONIC="word1 word2 ... word12"');
  console.error('  DATABASE_URL="postgresql://..."');
  console.error("");
  console.error("Copy values from Vercel → Project → Settings → Environment Variables.");
}

async function main() {
  if (!isListenerEnabled()) {
    printConfigHelp();
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
