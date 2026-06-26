import { isDepositSweeperEnabledSync } from "@/deposits/sweeper/diagnostics";

export const SWEEP_STATUS = {
  PENDING: "pending",
  FUNDING_GAS: "funding_gas",
  SWEEPING: "sweeping",
  SWEPT: "swept",
  REFUNDING: "refunding",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type SweepStatus = (typeof SWEEP_STATUS)[keyof typeof SWEEP_STATUS];

export function isDepositSweeperEnabled(): boolean {
  return isDepositSweeperEnabledSync();
}

export function getMaxSweepsPerTick(): number {
  const n = Number(process.env.SWEEPER_MAX_PER_TICK ?? 2);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export function getMaxSweepRetries(): number {
  const n = Number(process.env.SWEEPER_MAX_RETRIES ?? 5);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

export function getSweepTxConfirmations(): number {
  const n = Number(process.env.SWEEPER_TX_CONFIRMATIONS ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/** Max wait for on-chain confirmation (default 3 min — BSC usually confirms in under 30s). */
export function getSweepTxWaitMs(): number {
  const n = Number(process.env.SWEEPER_TX_WAIT_MS ?? 180_000);
  return Number.isFinite(n) && n >= 30_000 ? Math.floor(n) : 180_000;
}

/** Minimum recoverable BNB (wei) for refund — below this we skip. */
export function getMinBnbRefundWei(): bigint {
  const raw = process.env.SWEEPER_MIN_BNB_REFUND_WEI?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 10_000_000_000_000n; // 0.00001 BNB
}

/** Max deposits processed per admin manual run. */
export function getAdminSweepBatchLimit(): number {
  const n = Number(process.env.SWEEPER_ADMIN_BATCH_LIMIT ?? 20);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

/** Max BNB funding txs per sweep (top-ups until balance is enough). */
export function getMaxGasFundingTxs(): number {
  const n = Number(process.env.SWEEPER_MAX_GAS_FUNDING_TXS ?? 5);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}
