import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSafeWebhookUrl } from "@/lib/ssrf";

const VALID_EVENTS = ["order.completed", "offer.received", "withdrawal.approved", "airdrop.claimable"];

const schema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(["order.completed", "offer.received", "withdrawal.approved", "airdrop.claimable"])).min(1),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const webhooks = await prisma.webhook.findMany({ where: { userId: user.id }, select: { id: true, url: true, events: true, active: true, createdAt: true } });
  return NextResponse.json({ webhooks: webhooks.map(w => ({ ...w, events: JSON.parse(w.events) })), validEvents: VALID_EVENTS });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  if (!isSafeWebhookUrl(parsed.data.url)) {
    return NextResponse.json(
      { error: "Webhook URL must be a public HTTPS endpoint (no localhost or private IPs)" },
      { status: 400 }
    );
  }

  const count = await prisma.webhook.count({ where: { userId: user.id } });
  if (count >= 3) return NextResponse.json({ error: "Maximum 3 webhooks per account" }, { status: 400 });

  const secret = randomBytes(20).toString("hex");
  const webhook = await prisma.webhook.create({ data: { userId: user.id, url: parsed.data.url, secret, events: JSON.stringify(parsed.data.events), active: true } });
  return NextResponse.json({ webhook: { ...webhook, events: parsed.data.events }, secret }, { status: 201 });
}
