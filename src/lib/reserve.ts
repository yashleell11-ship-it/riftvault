export function getNextReserveReset(from = new Date()): Date {
  const currentKey = getReserveDayKey(from);

  for (let minutes = 1; minutes <= 24 * 60; minutes++) {
    const candidate = new Date(from.getTime() + minutes * 60 * 1000);
    if (getReserveDayKey(candidate) !== currentKey) {
      return candidate;
    }
  }

  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

// Re-export helpers used by API (defined above in same file)
export function getReserveTimezone() {
  return process.env.RESERVE_RESET_TIMEZONE ?? "Asia/Dubai";
}

export function getReserveDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getReserveTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const SLOTS_BY_LEVEL: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 10,
};

export function getMaxReserveSlots(level: number) {
  return SLOTS_BY_LEVEL[level] ?? Math.min(level, 10);
}
