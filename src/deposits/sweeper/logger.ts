export type SweepLogContext = {
  depositId: string;
  depositAddress?: string;
  amount?: string;
  gasSent?: string;
  gasFundingTxHash?: string;
  sweepTxHash?: string;
  gasRefundTxHash?: string;
  durationMs?: number;
  error?: string;
  step?: string;
  // ── Explicit diagnostics (Phase 5) — all optional, queryable per stage ──
  /** Treasury (hot-wallet) address funding the sweep. */
  treasury?: string;
  /** Pinned gas limit (units) for the sweep tx. */
  gasEstimate?: string;
  /** Pinned gas price in gwei. */
  gasPriceGwei?: string;
  /** BNB the wallet is funded to before sweeping. */
  fundingAmount?: string;
  /** Deposit-wallet BNB balance before/after funding. */
  balanceBefore?: string;
  balanceAfter?: string;
  /** USDT amount being swept. */
  usdtAmount?: string;
  /** Worst-case tx cost at pinned params (gasLimit * gasPrice), BNB. */
  maxTxCost?: string;
  /** Retry / attempt counters. */
  retryCount?: number;
  attempt?: number;
};

export function logSweepEvent(message: string, ctx: SweepLogContext) {
  const payload = {
    ts: new Date().toISOString(),
    service: "deposit-sweeper",
    message,
    ...ctx,
  };
  if (ctx.error) {
    console.error("[deposit-sweeper]", JSON.stringify(payload));
  } else {
    console.log("[deposit-sweeper]", JSON.stringify(payload));
  }
}
