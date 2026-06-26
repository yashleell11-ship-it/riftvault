import { isEnvFlagEnabled } from "@/deposits/blockchain/config";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getDepositMnemonic } from "@/deposits/blockchain/config";
import { getTreasuryPrivateKey } from "@/deposits/blockchain/wallet-client";

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
  return (
    isEnvFlagEnabled("ENABLE_DEPOSIT_SWEEPER") &&
    Boolean(getDepositMnemonic()) &&
    Boolean(getReceivingWallet()) &&
    Boolean(getTreasuryPrivateKey())
  );
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

/** Minimum recoverable BNB (wei) for refund — below this we skip. */
export function getMinBnbRefundWei(): bigint {
  const raw = process.env.SWEEPER_MIN_BNB_REFUND_WEI?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 10_000_000_000_000n; // 0.00001 BNB
}
