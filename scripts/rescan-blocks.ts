/**
 * Rescan a BSC block range for USDT checkout + wallet deposits (idempotent).
 *
 * Usage:
 *   npm run payments:rescan -- --from 106502787 --to 106502787
 *   npm run payments:rescan -- --block 106502787 --tx 0x6bc2...
 */
import "../src/lib/load-env";
import { prisma } from "../src/lib/db";
import { rescanUsdtBlockRange } from "../src/payments/listener/runner";
import { updateDepositConfirmations } from "../src/deposits/services/confirm-deposit";
import { updatePaymentConfirmations } from "../src/payments/listener/transfer-scanner";

function parseArgs() {
  const args = process.argv.slice(2);
  let fromBlock: bigint | null = null;
  let toBlock: bigint | null = null;
  let txHash: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--from" && args[i + 1]) {
      fromBlock = BigInt(args[++i]!);
    } else if (arg === "--to" && args[i + 1]) {
      toBlock = BigInt(args[++i]!);
    } else if (arg === "--block" && args[i + 1]) {
      fromBlock = BigInt(args[++i]!);
      toBlock = fromBlock;
    } else if (arg === "--tx" && args[i + 1]) {
      txHash = args[++i]!.toLowerCase();
    }
  }

  if (fromBlock == null || toBlock == null) {
    console.error(
      "Usage: npm run payments:rescan -- --from <block> --to <block>\n" +
        "       npm run payments:rescan -- --block <block> [--tx <hash>]"
    );
    process.exit(1);
  }

  return { fromBlock, toBlock, txHash };
}

async function main() {
  const { fromBlock, toBlock, txHash } = parseArgs();

  console.log(`[rescan] blocks ${fromBlock}–${toBlock} (cursor unchanged)`);

  const result = await rescanUsdtBlockRange(fromBlock, toBlock);
  await updatePaymentConfirmations();
  await updateDepositConfirmations();

  console.log(
    `[rescan] ok scanned=${result.scanned} checkout=${result.matched} deposits=${result.depositMatched}`
  );

  if (txHash) {
    const deposits = await prisma.cryptoDeposit.findMany({
      where: { txHash },
    });
    console.log(`[rescan] cryptoDeposit rows for ${txHash}:`, deposits.length);
    for (const d of deposits) {
      console.log(
        `  id=${d.id} userId=${d.userId} amount=${d.amount} status=${d.status} walletTxId=${d.walletTxId ?? "null"} logIndex=${d.logIndex}`
      );
    }

    const walletCredits = await prisma.walletTransaction.count({
      where: {
        type: "deposit",
        description: { contains: txHash.slice(0, 10) },
      },
    });
    console.log(`[rescan] wallet deposit txs matching tx prefix: ${walletCredits}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[rescan] fatal:", error);
  process.exit(1);
});
