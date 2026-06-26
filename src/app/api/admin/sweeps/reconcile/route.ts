import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { backfillLegacyDepositsForSweeper } from "@/deposits/sweeper/backfill";
import {
  ensureOpenDepositsForFundedAddresses,
  resetMiscompletedDepositsWithOnChainUsdt,
} from "@/deposits/sweeper/reset-miscompleted";
import { reconcileSiblingDepositsAtEmptyAddresses } from "@/deposits/sweeper/reconcile";

export const dynamic = "force-dynamic";

/** Backfill legacy rows + mark siblings completed when address has no USDT. */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const backfill = await backfillLegacyDepositsForSweeper();
  const resetMiscompleted = await resetMiscompletedDepositsWithOnChainUsdt();
  const reopened = await ensureOpenDepositsForFundedAddresses();
  const reconciled = await reconcileSiblingDepositsAtEmptyAddresses();
  return NextResponse.json({ ok: true, backfill, resetMiscompleted, reopened, reconciled });
}
