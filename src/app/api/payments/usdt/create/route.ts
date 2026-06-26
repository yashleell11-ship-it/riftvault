import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isUsdtPaymentsEnabled } from "@/payments/blockchain/config";
import { createUsdtPaymentOrder } from "@/payments/services/payment-order.service";
import { z } from "zod";

const schema = z.object({ nftId: z.string().min(1) });

export async function GET() {
  return NextResponse.json({
    enabled: isUsdtPaymentsEnabled(),
    asset: "USDT",
    network: "BNB Smart Chain (BEP20)",
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isUsdtPaymentsEnabled()) {
    return NextResponse.json(
      { error: "USDT BEP20 payments are not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const order = await createUsdtPaymentOrder({
      userId: user.id,
      nftId: parsed.data.nftId,
    });

    return NextResponse.json({
      paymentOrderId: order.id,
      checkoutUrl: `/checkout/usdt/${order.id}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not create payment";
    const status = msg.includes("not for sale") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
