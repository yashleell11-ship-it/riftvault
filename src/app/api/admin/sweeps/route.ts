import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { getSweeperDiagnostics } from "@/deposits/sweeper/diagnostics";
import { readOnChainUsdtByAddress } from "@/deposits/sweeper/queue";

const DEPOSIT_SELECT = {
  id: true,
  amount: true,
  asset: true,
  txHash: true,
  toAddress: true,
  status: true,
  sweepStatus: true,
  sweptAt: true,
  sweepTxHash: true,
  gasFundingTxHash: true,
  gasRefundTxHash: true,
  retryCount: true,
  sweepError: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, displayName: true } },
} as const;

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all";

  const baseWhere = {
    status: "confirmed" as const,
    walletTxId: { not: null },
  };

  let where: Record<string, unknown> = baseWhere;

  if (filter === "pending") {
    where = {
      ...baseWhere,
      NOT: { sweepStatus: SWEEP_STATUS.COMPLETED },
    };
  } else if (filter === "completed") {
    where = { ...baseWhere, sweepStatus: SWEEP_STATUS.COMPLETED };
  } else if (filter === "failed") {
    where = { ...baseWhere, sweepStatus: SWEEP_STATUS.FAILED };
  } else if (filter === "gas") {
    where = {
      ...baseWhere,
      OR: [
        { gasFundingTxHash: { not: null } },
        { gasRefundTxHash: { not: null } },
      ],
    };
  }

  const deposits = await prisma.cryptoDeposit.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: DEPOSIT_SELECT,
  });

  const onChainUsdt = await readOnChainUsdtByAddress(
    deposits.map((d) => d.toAddress).filter(Boolean) as string[]
  );

  const diagnostics = await getSweeperDiagnostics();

  return NextResponse.json({
    enabled: diagnostics.enabled,
    diagnostics,
    deposits: deposits.map((d) => ({
      ...d,
      onChainUsdt: d.toAddress ? onChainUsdt.get(d.toAddress.toLowerCase()) ?? "0" : null,
    })),
  });
}
