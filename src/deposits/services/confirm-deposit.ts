import { formatUnits } from "viem";
import { prisma } from "@/lib/db";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";
import { getDepositRequiredConfirmations } from "@/deposits/blockchain/config";

export async function confirmCryptoDeposit(depositId: string) {
  const deposit = await prisma.cryptoDeposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error("Deposit not found");
  if (deposit.status === "confirmed") return deposit;
  if (deposit.status === "rejected") throw new Error("Deposit was rejected");

  const result = await prisma.$transaction(async (tx) => {
    const walletTx = await creditWallet(tx, {
      userId: deposit.userId,
      amount: deposit.amount,
      currency: deposit.asset,
      type: "deposit",
      description: deposit.txHash
        ? `USDT deposit ${deposit.txHash.slice(0, 10)}…`
        : "USDT deposit (auto-detected)",
    });

    return tx.cryptoDeposit.update({
      where: { id: depositId },
      data: {
        status: "confirmed",
        walletTxId: walletTx.id,
      },
    });
  });

  await createNotification(prisma, {
    userId: deposit.userId,
    type: "deposit",
    title: "Deposit credited",
    body: `${deposit.amount} ${deposit.asset} was added to your wallet.`,
    link: "/dashboard/wallet",
  });

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
      ...(depositId ? { id: depositId } : {}),
    },
  });

  for (const deposit of deposits) {
    if (deposit.blockNumber == null) continue;

    const confirmations = Number(latestBlock - BigInt(deposit.blockNumber) + 1n);
    const nextStatus = confirmations >= required ? "confirming" : "detecting";

    await prisma.cryptoDeposit.update({
      where: { id: deposit.id },
      data: { confirmations, status: nextStatus },
    });

    if (confirmations >= required) {
      await confirmCryptoDeposit(deposit.id);
    }
  }
}
