import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reconcileSiblingDepositsAtEmptyAddresses } from "@/deposits/sweeper/reconcile";

export const dynamic = "force-dynamic";

/** Mark sibling deposits completed when their address has no USDT left. */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reconciled = await reconcileSiblingDepositsAtEmptyAddresses();
  return NextResponse.json({ ok: true, reconciled });
}
