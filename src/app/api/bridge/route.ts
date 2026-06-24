import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BRIDGE_ROUTES, findBridgeRoute } from "@/lib/bridge";
import { bridgeIntentSchema } from "@/lib/validations";

export async function GET() {
  const user = await getSessionUser();

  const routes = BRIDGE_ROUTES;
  if (!user) {
    return NextResponse.json({ routes });
  }

  const intents = await prisma.bridgeIntent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ routes, intents });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = bridgeIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { fromChain, toChain, token, amount } = parsed.data;
    const route = findBridgeRoute(fromChain, toChain, token);
    if (!route) {
      return NextResponse.json({ error: "Unsupported bridge route" }, { status: 400 });
    }
    if (amount < route.minAmount) {
      return NextResponse.json(
        { error: `Minimum amount is ${route.minAmount} ${token}` },
        { status: 400 }
      );
    }

    const intent = await prisma.bridgeIntent.create({
      data: {
        userId: user.id,
        fromChain,
        toChain,
        token: token.toUpperCase(),
        amount,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      intent,
      route,
      message: "Bridge intent recorded. Complete the transfer via your wallet and external bridge.",
    });
  } catch (error) {
    console.error("Bridge intent error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
