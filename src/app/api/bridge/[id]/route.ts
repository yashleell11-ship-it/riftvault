import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BRIDGE_ROUTES } from "@/lib/bridge";

const patchSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  status: z.enum(["completed", "cancelled"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const intent = await prisma.bridgeIntent.findFirst({
    where: { id, userId: user.id },
  });

  if (!intent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.bridgeIntent.update({
    where: { id },
    data: {
      txHash: parsed.data.txHash ?? intent.txHash,
      status: parsed.data.status ?? (parsed.data.txHash ? "completed" : intent.status),
    },
  });

  return NextResponse.json({ success: true, intent: updated });
}
