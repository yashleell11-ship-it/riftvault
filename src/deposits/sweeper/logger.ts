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
