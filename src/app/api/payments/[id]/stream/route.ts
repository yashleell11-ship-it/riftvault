import { getSessionUser } from "@/lib/auth";
import {
  getPaymentOrderStatus,
  toStatusPayload,
} from "@/payments/services/payment-order.service";
import { runPaymentListenerTick } from "@/payments/listener/runner";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let closed = false;
      const maxTicks = 120;
      let tick = 0;

      while (!closed && tick < maxTicks) {
        tick += 1;
        try {
          await runPaymentListenerTick({ paymentOrderId: id, maxBlocks: 50 });
          const order = await getPaymentOrderStatus(id, user.id);
          if (!order) {
            send({ error: "not_found" });
            break;
          }
          send(toStatusPayload(order));
          if (order.status === "paid" || order.status === "expired" || order.status === "failed") {
            break;
          }
        } catch (error) {
          console.error("[payments/stream]", error);
          send({ error: "listener_error" });
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
