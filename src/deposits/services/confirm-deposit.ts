import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { getDepositRequiredConfirmations } from "@/deposits/blockchain/config";

const CONFIRMABLE_STATUSES = ["pending", "detecting", "confirming"] as const;

export async function confirmCryptoDeposit(depositId: string) {
  const { result, credited } = await prisma.$transaction(async (tx) => {
    const deposit = await tx.cryptoDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === "confirmed" || deposit.walletTxId) {
      return { result: deposit, credited: false };
    }
    if (deposit.status === "rejected") throw new Error("Deposit was rejected");

    const claimed = await tx.cryptoDeposit.updateMany({
      where: {
        id: depositId,
        walletTxId: null,
        status: { in: [...CONFIRMABLE_STATUSES] },
      },
      data: { status: "confirming" },
    });

    if (claimed.count === 0) {
      const current = await tx.cryptoDeposit.findUnique({ where: { id: depositId } });
      if (current?.status === "confirmed" || current?.walletTxId) {
        return { result: current, credited: false };
      }
      throw new Error("Deposit already processed");
    }

    const walletTx = await creditWallet(tx, {
      userId: deposit.userId,
      amount: deposit.amount,
      currency: deposit.asset,
      type: "deposit",
      description: deposit.txHash
        ? `USDT deposit ${deposit.txHash.slice(0, 10)}…`
        : "USDT deposit (auto-detected)",
    });

    const updated = await tx.cryptoDeposit.update({
      where: { id: depositId },
      data: {
        status: "confirmed",
        walletTxId: walletTx.id,
      },
    });

    return { result: updated, credited: true };
  });

  if (credited) {
    await createNotification(prisma, {
      userId: result.userId,
      type: "deposit",
      title: "Deposit credited",
      body: `${result.amount} ${result.asset} was added to your wallet.`,
      link: "/dashboard/wallet",
    });
  }

  return result;
}

export function rawUsdtToFloat(amountRaw: string): number {
  const formatted = formatUnits(BigInt(amountRaw), USDT_DECIMALS);
  return Math.round(parseFloat(formatted) * 1e6) / 1e6;
}

export async function updateDepositConfirmations(depositId?: string) {
  const client = await import("@/payments/blockchain/client").then((m) => m.getBscPublicClient());
  const latestBlock = await client.getBlockNumber();
  const required = getDepositRequiredConfirmations();

  const deposits = await prisma.cryptoDeposit.findMany({
    where: {
      status: { in: ["detecting", "confirming"] },
      txHash: { not: null },
      blockNumber: { not: null },
      autoDetected: true,
      walletTxId: null,
      ...(depositId ? { id: depositId } : {}),
    },
  });

  for (const deposit of deposits) {
    if (deposit.blockNumber == null) continue;

    const confirmations = Number(latestBlock - BigInt(deposit.blockNumber) + 1n);
    const nextStatus = confirmations >= required ? "confirming" : "detecting";

    await prisma.cryptoDeposit.updateMany({
      where: { id: deposit.id, walletTxId: null, status: { in: ["detecting", "confirming"] } },
      data: { confirmations, status: nextStatus },
    });

    if (confirmations >= required) {
      try {
        await confirmCryptoDeposit(deposit.id);
      } catch (error) {
        console.error("[confirm-deposit] confirm failed:", deposit.id, error);
      }
    }
  }
}
