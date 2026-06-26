/**
 * Local / remote treasury sweeper tick.
 * Requires DATABASE_URL, DEPOSIT_MNEMONIC, RECEIVING_WALLET, TREASURY_PRIVATE_KEY, BSC_RPC_URL.
 */
import { config } from "dotenv";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
config({ path: ".env.local" });
config({ path: ".env.payments.local" });

async function main() {
  const { runSweeperTick } = await import("../src/deposits/sweeper/runner");
  const { isDepositSweeperEnabled } = await import("../src/deposits/sweeper/config");

  if (!isDepositSweeperEnabled()) {
    console.error(
      "Sweeper not configured. Set ENABLE_DEPOSIT_SWEEPER=true, DEPOSIT_MNEMONIC, RECEIVING_WALLET, TREASURY_PRIVATE_KEY."
    );
    process.exit(1);
  }

  const result = await runSweeperTick();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
