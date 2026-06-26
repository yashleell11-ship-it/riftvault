import { prisma } from "@/lib/db";
import type { ScannedTransfer } from "@/payments/listener/transfer-scanner";
import { rawUsdtToFloat } from "@/deposits/services/confirm-deposit";

export type DepositOwner = {
  userId: string;
  chainKey: string;
  asset: string;
};

/** Idempotent — returns true when a new CryptoDeposit row was created. */
export async function recordDepositTransfer(
  transfer: ScannedTransfer,
  owner: DepositOwner
): Promise<boolean> {
  const existing = await prisma.cryptoDeposit.findUnique({
    where: {
      txHash_logIndex: {
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
      },
    },
  });
  if (existing) return false;

  const amount = rawUsdtToFloat(transfer.amountRaw);

  try {
    await prisma.cryptoDeposit.create({
      data: {
        userId: owner.userId,
        chainKey: owner.chainKey,
        asset: owner.asset,
        amount,
        amountRaw: transfer.amountRaw,
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
        blockNumber: Number(transfer.blockNumber),
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        status: "detecting",
        confirmations: 1,
        autoDetected: true,
      },
    });
    return true;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") return false;
    throw error;
  }
}
