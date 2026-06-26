import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { rescanUsdtBlockRange } from "@/payments/listener/runner";
import { updateDepositConfirmations } from "@/deposits/services/confirm-deposit";
import { updatePaymentConfirmations } from "@/payments/listener/transfer-scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  fromBlock: z.number().int().nonnegative(),
  toBlock: z.number().int().nonnegative(),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

const MAX_BLOCK_SPAN = 500;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fromBlock, toBlock, txHash } = parsed.data;
  if (toBlock < fromBlock) {
    return NextResponse.json({ error: "toBlock must be >= fromBlock" }, { status: 400 });
  }
  if (toBlock - fromBlock > MAX_BLOCK_SPAN) {
    return NextResponse.json(
      { error: `Block span cannot exceed ${MAX_BLOCK_SPAN}` },
      { status: 400 }
    );
  }

  try {
    const result = await rescanUsdtBlockRange(BigInt(fromBlock), BigInt(toBlock));
    await updatePaymentConfirmations();
    await updateDepositConfirmations();

    return NextResponse.json({
      ok: true,
      txHash: txHash ?? null,
      fromBlock,
      toBlock,
      scanned: result.scanned,
      checkoutMatched: result.matched,
      depositMatched: result.depositMatched,
      latestBlock: result.latestBlock.toString(),
    });
  } catch (error) {
    console.error("[admin/payments/rescan]", error);
    return NextResponse.json(
      {
        error: "Rescan failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
