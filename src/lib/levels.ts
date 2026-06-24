export const LEVEL_THRESHOLDS = [
  { level: 1, minTrades: 0 },
  { level: 2, minTrades: 1 },
  { level: 3, minTrades: 5 },
  { level: 4, minTrades: 15 },
  { level: 5, minTrades: 50 },
] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].level;

export function levelLabel(level: number) {
  return `LV${level}`;
}

export function computeLevelFromTradeCount(tradeCount: number) {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (tradeCount >= threshold.minTrades) level = threshold.level;
  }
  return level;
}

export function getLevelProgress(tradeCount: number) {
  const currentLevel = computeLevelFromTradeCount(tradeCount);
  const currentThreshold = LEVEL_THRESHOLDS.find((t) => t.level === currentLevel)!;
  const nextThreshold = LEVEL_THRESHOLDS.find((t) => t.level === currentLevel + 1);

  if (!nextThreshold) {
    return {
      currentLevel,
      nextLevel: null as number | null,
      tradeCount,
      tradesForNext: null as number | null,
      progress: 1,
      tradesRemaining: 0,
    };
  }

  const span = nextThreshold.minTrades - currentThreshold.minTrades;
  const progress =
    span > 0 ? (tradeCount - currentThreshold.minTrades) / span : 0;

  return {
    currentLevel,
    nextLevel: nextThreshold.level,
    tradeCount,
    tradesForNext: nextThreshold.minTrades,
    progress: Math.min(1, Math.max(0, progress)),
    tradesRemaining: Math.max(0, nextThreshold.minTrades - tradeCount),
  };
}
