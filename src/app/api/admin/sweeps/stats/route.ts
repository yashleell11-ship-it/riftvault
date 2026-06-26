import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { readUsdtBalance } from "@/deposits/blockchain/erc20";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { getSweeperDiagnostics, verifyTreasuryWalletMatch } from "@/deposits/sweeper/diagnostics";
import { countDepositsToSweep } from "@/deposits/sweeper/queue";
import { reconcileSiblingDepositsAtEmptyAddresses } from "@/deposits/sweeper/reconcile";
import { backfillLegacyDepositsForSweeper } from "@/deposits/sweeper/backfill";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const receiving = getReceivingWallet();
  let treasuryBnb = "0";
  let treasuryUsdt = "0";

  if (receiving) {
    try {
      const client = getBscPublicClient();
      const [bnb, usdt] = await Promise.all([
        client.getBalance({ address: receiving }),
        readUsdtBalance(client, receiving),
      ]);
      treasuryBnb = formatUnits(bnb, 18);
      treasuryUsdt = formatUnits(usdt, 18);
    } catch (error) {
      console.error("[admin/sweeps/stats] treasury balance read failed:", error);
    }
  }

  const backfill = await backfillLegacyDepositsForSweeper();
  const reconciled = await reconcileSiblingDepositsAtEmptyAddresses();

  const openWhere = {
    status: "confirmed" as const,
    walletTxId: { not: null },
    NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
  };

  const [pending, queueReady, completed, failed, gasFunded, refunded] = await Promise.all([
    prisma.cryptoDeposit.count({ where: openWhere }),
    countDepositsToSweep(),
    prisma.cryptoDeposit.count({
      where: { sweepStatus: SWEEP_STATUS.COMPLETED },
    }),
    prisma.cryptoDeposit.count({
      where: { sweepStatus: SWEEP_STATUS.FAILED },
    }),
    prisma.cryptoDeposit.count({
      where: { gasFundingTxHash: { not: null } },
    }),
    prisma.cryptoDeposit.count({
      where: { gasRefundTxHash: { not: null } },
    }),
  ]);

  const diagnostics = await getSweeperDiagnostics();
  const treasuryMatch = verifyTreasuryWalletMatch();

  return NextResponse.json({
    enabled: diagnostics.enabled,
    diagnostics,
    treasuryMatch,
    receivingWallet: receiving,
    treasury: { bnb: treasuryBnb, usdt: treasuryUsdt },
    counts: { pending, queueReady, completed, failed, gasFunded, refunded },
    backfill,
    reconciled,
  });
}
