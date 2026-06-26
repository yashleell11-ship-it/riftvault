import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { creditWallet } from "@/lib/wallet";
import { adminDepositActionSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = adminDepositActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const deposit = await prisma.cryptoDeposit.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });

  if (!deposit || !["pending", "detecting", "confirming"].includes(deposit.status)) {
    return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });
  }

  if (deposit.walletTxId && deposit.status === "confirmed") {
    return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });
  }

  if (parsed.data.action === "reject") {
    const updated = await prisma.cryptoDeposit.update({
      where: { id },
      data: { status: "rejected" },
    });

    await createNotification(prisma, {
      userId: deposit.userId,
      type: "deposit",
      title: "Deposit not credited",
      body: `Your ${deposit.amount} ${deposit.asset} deposit could not be verified.`,
      link: "/dashboard/wallet",
    });

    await logAudit({
      actorId: admin.id,
      action: "deposit.reject",
      targetType: "crypto_deposit",
      targetId: id,
      detail: `${deposit.amount} ${deposit.asset}`,
    });

    return NextResponse.json({ success: true, deposit: updated });
  }

  const updated = await prisma.$transaction(async (db) => {
    const claimed = await db.cryptoDeposit.updateMany({
      where: {
        id,
        walletTxId: null,
        status: { in: ["pending", "detecting", "confirming"] },
      },
      data: { status: "confirming" },
    });

    if (claimed.count === 0) {
      const current = await db.cryptoDeposit.findUnique({ where: { id } });
      if (current?.status === "confirmed" || current?.walletTxId) return current;
      throw new Error("ALREADY_PROCESSED");
    }

    const walletTx = await creditWallet(db, {
      userId: deposit.userId,
      amount: deposit.amount,
      currency: deposit.asset,
      type: "deposit",
      description: deposit.txHash
        ? `On-chain deposit ${deposit.txHash.slice(0, 10)}…`
        : "On-chain deposit (confirmed by admin)",
    });

    return db.cryptoDeposit.update({
      where: { id },
      data: { status: "confirmed", walletTxId: walletTx.id, sweepStatus: "pending" },
    });
  }).catch((error) => {
    if (error instanceof Error && error.message === "ALREADY_PROCESSED") return null;
    throw error;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });
  }

  await createNotification(prisma, {
    userId: deposit.userId,
    type: "deposit",
    title: "Deposit credited",
    body: `${deposit.amount} ${deposit.asset} was added to your wallet balance.`,
    link: "/dashboard/wallet",
  });

  await logAudit({
    actorId: admin.id,
    action: "deposit.confirm",
    targetType: "crypto_deposit",
    targetId: id,
    detail: `${deposit.amount} ${deposit.asset}`,
  });

  return NextResponse.json({ success: true, deposit: updated });
}
