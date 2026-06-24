import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendWithdrawalStatusEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tx = await prisma.walletTransaction.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!tx || tx.status !== "pending") return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });

  const status = parsed.data.action === "approve" ? "completed" : "rejected";
  const updated = await prisma.walletTransaction.update({ where: { id }, data: { status } });

  await createNotification(prisma, {
    userId: tx.userId,
    type: "withdrawal",
    title: status === "completed" ? "Withdrawal approved" : "Withdrawal rejected",
    body: `Your withdrawal of ${Math.abs(tx.amount)} ${tx.currency} has been ${status === "completed" ? "approved and processed" : "rejected"}.`,
    link: "/dashboard/wallet",
  });

  // Fire email (non-blocking)
  sendWithdrawalStatusEmail(
    tx.user.email,
    parsed.data.action === "approve" ? "approved" : "rejected",
    Math.abs(tx.amount),
    tx.currency
  ).catch(console.error);

  await logAudit({
    actorId: admin.id,
    action: `withdrawal.${parsed.data.action}`,
    targetType: "wallet_transaction",
    targetId: id,
    detail: `${Math.abs(tx.amount)} ${tx.currency}`,
  });

  return NextResponse.json({ success: true, tx: updated });
}
