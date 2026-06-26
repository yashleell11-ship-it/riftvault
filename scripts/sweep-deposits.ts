/**
 * Local treasury sweeper — runs until all pending deposits are consolidated.
 * Requires DATABASE_URL, DEPOSIT_MNEMONIC, RECEIVING_WALLET, TREASURY_PRIVATE_KEY, BSC_RPC_URL.
 */
import { config } from "dotenv";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
config({ path: ".env.local" });
config({ path: ".env.payments.local" });

async function main() {
  const { runSweeperUntilDone, countDepositsToSweep } = await import(
    "../src/deposits/sweeper/runner"
  );
  const { isDepositSweeperEnabled } = await import("../src/deposits/sweeper/config");

  if (!isDepositSweeperEnabled()) {
    console.error(
      "Sweeper not configured. Set ENABLE_DEPOSIT_SWEEPER=true, DEPOSIT_MNEMONIC, RECEIVING_WALLET, TREASURY_PRIVATE_KEY."
    );
    process.exit(1);
  }

  let totalRounds = 0;
  let totalCompleted = 0;

  while ((await countDepositsToSweep()) > 0) {
    const result = await runSweeperUntilDone({
      maxWallMs: 600_000,
      includeDiagnostics: totalRounds === 0,
    });
    totalRounds += result.rounds;
    totalCompleted += result.completed;
    console.log(
      JSON.stringify(
        {
          rounds: result.rounds,
          completed: result.completed,
          failed: result.failed,
          remainingPending: result.remainingPending,
          drained: result.drained,
        },
        null,
        2
      )
    );
    if (result.drained) break;
    if (result.rounds === 0) break;
  }

  const remaining = await countDepositsToSweep();
  console.log(
    JSON.stringify({ totalRounds, totalCompleted, remainingPending: remaining }, null, 2)
  );
  process.exit(remaining > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
