import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getMaxReserveSlots,
  getNextReserveReset,
  getReserveDayKey,
  getReserveTimezone,
} from "@/lib/reserve";
import { levelLabel } from "@/lib/levels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayKey = getReserveDayKey();
  const usedToday = await prisma.reservation.count({
    where: { userId: user.id, dayKey },
  });

  const maxSlots = getMaxReserveSlots(user.level);
  const resetsAt = getNextReserveReset();

  return NextResponse.json({
    level: user.level,
    levelLabel: levelLabel(user.level),
    maxSlots,
    usedToday,
    remaining: Math.max(0, maxSlots - usedToday),
    dayKey,
    timezone: getReserveTimezone(),
    resetsAt: resetsAt.toISOString(),
  });
}
