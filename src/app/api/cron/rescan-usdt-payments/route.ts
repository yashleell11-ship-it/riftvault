import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeCronOrVercelCli } from "@/lib/cron-auth";
import { rescanUsdtBlockRange, rescanUsdtTransaction } from "@/payments/listener/runner";
import { updateDepositConfirmations } from "@/deposits/services/confirm-deposit";
import { updatePaymentConfirmations } from "@/payments/listener/transfer-scanner";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z
  .object({
    fromBlock: z.number().int().nonnegative().optional(),
    toBlock: z.number().int().nonnegative().optional(),
    txHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/)
      .optional(),
  })
  .refine((d) => d.txHash || (d.fromBlock !== undefined && d.toBlock !== undefined), {
    message: "Provide txHash or both fromBlock and toBlock",
  });

const MAX_BLOCK_SPAN = 500;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export async function POST(request: Request) {
  if (!(await authorizeCronOrVercelCli(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (!txHash) {
    if (toBlock! < fromBlock!) {
      return NextResponse.json({ error: "toBlock must be >= fromBlock" }, { status: 400 });
    }
    if (toBlock! - fromBlock! > MAX_BLOCK_SPAN) {
      return NextResponse.json(
        { error: `Block span cannot exceed ${MAX_BLOCK_SPAN}` },
        { status: 400 }
      );
    }
  }

  try {
    let result;
    if (txHash) {
      const txResult = await rescanUsdtTransaction(txHash as `0x${string}`);
      result = {
        scanned: 1,
        matched: txResult.matched,
        depositMatched: txResult.depositMatched,
        latestBlock: txResult.latestBlock,
        fromBlock: txResult.blockNumber,
        toBlock: txResult.blockNumber,
        transfersProcessed: txResult.transfersProcessed,
        skippedUnknownRecipient: txResult.skippedUnknownRecipient,
      };
    } else {
      const range = await rescanUsdtBlockRange(BigInt(fromBlock!), BigInt(toBlock!));
      result = { ...range, transfersProcessed: null, skippedUnknownRecipient: null };
    }

    await updatePaymentConfirmations();
    await updateDepositConfirmations();

    let depositRows: Array<{
      id: string;
      userId: string;
      amount: number;
      status: string;
      walletTxId: string | null;
      logIndex: number | null;
    }> = [];

    if (txHash) {
      depositRows = await prisma.cryptoDeposit.findMany({
        where: { txHash: txHash.toLowerCase() },
        select: {
          id: true,
          userId: true,
          amount: true,
          status: true,
          walletTxId: true,
          logIndex: true,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      fromBlock: txHash ? Number(result.fromBlock) : fromBlock,
      toBlock: txHash ? Number(result.toBlock) : toBlock,
      scanned: result.scanned,
      checkoutMatched: result.matched,
      depositMatched: result.depositMatched,
      latestBlock: result.latestBlock.toString(),
      txHash: txHash ?? null,
      transfersProcessed: result.transfersProcessed,
      skippedUnknownRecipient: result.skippedUnknownRecipient,
      depositsForTx: depositRows,
    });
  } catch (error) {
    console.error("[cron/rescan-usdt-payments]", error);
    return NextResponse.json(
      { ok: false, error: "Rescan failed", details: serializeError(error) },
      { status: 500 }
    );
  }
}
