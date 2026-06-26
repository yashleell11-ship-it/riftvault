import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";
import { resetStaleSweepFailures } from "@/deposits/sweeper/runner";
import { logSweepEvent } from "@/deposits/sweeper/logger";

export const dynamic = "force-dynamic";

/** Reset failed sweep rows so they can be retried (timeouts, RPC errors, etc.). */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let depositId: string | undefined;
  try {
    const body = (await request.json()) as { depositId?: string };
    depositId = body.depositId?.trim() || undefined;
  } catch {
    depositId = undefined;
  }

  if (depositId) {
    const deposit = await prisma.cryptoDeposit.findUnique({
      where: { id: depositId },
      select: { id: true, sweepStatus: true, status: true, walletTxId: true },
    });

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }
    if (deposit.sweepStatus !== SWEEP_STATUS.FAILED) {
      return NextResponse.json(
        { error: "Deposit is not in failed sweep state", sweepStatus: deposit.sweepStatus },
        { status: 400 }
      );
    }

    await prisma.cryptoDeposit.update({
      where: { id: depositId },
      data: {
        sweepStatus: SWEEP_STATUS.PENDING,
        retryCount: 0,
        sweepError: null,
      },
    });

    logSweepEvent("Admin reset failed sweep", {
      depositId,
      step: "admin_reset_failed",
    });

    return NextResponse.json({ ok: true, reset: 1, depositId });
  }

  const reset = await resetStaleSweepFailures();
  return NextResponse.json({ ok: true, reset });
}
