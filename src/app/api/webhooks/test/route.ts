import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signWebhookPayload } from "@/lib/apikeys";
import { isSafeWebhookUrl } from "@/lib/ssrf";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhooks = await prisma.webhook.findMany({ where: { userId: user.id, active: true } });
  if (webhooks.length === 0) return NextResponse.json({ error: "No active webhooks" }, { status: 400 });

  const payload = JSON.stringify({ event: "order.completed", test: true, ts: Date.now(), userId: user.id });
  const results = await Promise.allSettled(
    webhooks.map(async (wh) => {
      if (!isSafeWebhookUrl(wh.url)) {
        return { url: wh.url, status: 0, ok: false, error: "blocked_unsafe_url" };
      }
      const sig = signWebhookPayload(wh.secret, payload);
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RiftVault-Signature": sig, "X-RiftVault-Event": "order.completed" },
        body: payload,
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      return { url: wh.url, status: res.status, ok: res.ok };
    })
  );

  return NextResponse.json({ results: results.map(r => r.status === "fulfilled" ? r.value : { url: "unknown", error: String(r.reason) }) });
}
