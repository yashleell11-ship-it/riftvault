import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getPaymentOrderStatus,
  toStatusPayload,
} from "@/payments/services/payment-order.service";
import { runPaymentListenerTick } from "@/payments/listener/runner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Trigger a lightweight scan while the client polls (serverless-friendly).
  try {
    await runPaymentListenerTick({ paymentOrderId: id, maxBlocks: 100 });
  } catch (error) {
    console.error("[payments/status] listener tick:", error);
  }

  const order = await getPaymentOrderStatus(id, user.id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toStatusPayload(order));
}
