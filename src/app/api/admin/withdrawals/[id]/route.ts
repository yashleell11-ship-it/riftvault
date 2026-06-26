import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendWithdrawalStatusEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { creditWallet } from "@/lib/wallet";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tx = await prisma.walletTransaction.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!tx || tx.status !== "pending") {
    return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });
  }

  const amount = Math.abs(tx.amount);
  const action = parsed.data.action;
  const status = action === "approve" ? "completed" : "rejected";

  const updated = await prisma.$transaction(async (db) => {
    const current = await db.walletTransaction.findUnique({ where: { id } });
    if (!current || current.status !== "pending") {
      throw new Error("ALREADY_PROCESSED");
    }

    const row = await db.walletTransaction.update({
      where: { id },
      data: { status },
    });

    if (action === "reject") {
      await creditWallet(db, {
        userId: tx.userId,
        amount,
        currency: tx.currency,
        type: "deposit",
        description: "Withdrawal rejected — funds returned to balance",
      });
    }

    return row;
  }).catch((error) => {
    if (error instanceof Error && error.message === "ALREADY_PROCESSED") return null;
    throw error;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });
  }

  await createNotification(prisma, {
    userId: tx.userId,
    type: "withdrawal",
    title: status === "completed" ? "Withdrawal approved" : "Withdrawal rejected",
    body: `Your withdrawal of ${amount} ${tx.currency} has been ${status === "completed" ? "approved and processed" : "rejected"}. Funds were ${status === "completed" ? "sent" : "returned to your balance"}.`,
    link: "/dashboard/wallet",
  });

  sendWithdrawalStatusEmail(
    tx.user.email,
    action === "approve" ? "approved" : "rejected",
    amount,
    tx.currency
  ).catch(console.error);

  await logAudit({
    actorId: admin.id,
    action: `withdrawal.${action}`,
    targetType: "wallet_transaction",
    targetId: id,
    detail: `${amount} ${tx.currency}`,
  });

  return NextResponse.json({ success: true, tx: updated });
}
