/**
 * USDT BEP20 payment configuration — all secrets via environment variables.
 * Swap RECEIVING_WALLET for a Ledger address later without code changes.
 */

export const BSC_MAINNET_CHAIN_ID = 56;

/** BSC mainnet USDT (BEP20), 18 decimals */
export const BSC_USDT_MAINNET =
  "0x55d398326f99059fF775485246999027B3197955" as const;

/** BSC testnet mock USDT for development */
export const BSC_USDT_TESTNET =
  "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as const;

export function getReceivingWallet(): `0x${string}` | null {
  const raw = process.env.RECEIVING_WALLET?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw as `0x${string}`;
}

export function getBscRpcUrl(): string {
  return (
    process.env.BSC_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_BSC_RPC_URL?.trim() ||
    "https://bsc-dataseed.binance.org"
  );
}

export function getBscChainId(): number {
  const id = Number(process.env.BSC_CHAIN_ID ?? BSC_MAINNET_CHAIN_ID);
  return Number.isFinite(id) ? id : BSC_MAINNET_CHAIN_ID;
}

export function getUsdtContractAddress(): `0x${string}` {
  const override = process.env.BSC_USDT_CONTRACT?.trim();
  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) {
    return override as `0x${string}`;
  }
  return getBscChainId() === BSC_MAINNET_CHAIN_ID
    ? BSC_USDT_MAINNET
    : BSC_USDT_TESTNET;
}

export function getRequiredConfirmations(): number {
  const n = Number(process.env.PAYMENT_CONFIRMATIONS ?? 12);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

export function getPaymentExpiryMinutes(): number {
  const n = Number(process.env.PAYMENT_ORDER_EXPIRY_MINUTES ?? 60);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

export function isUsdtPaymentsEnabled(): boolean {
  return Boolean(getReceivingWallet() && getBscRpcUrl());
}

export function getListenerPollMs(): number {
  const n = Number(process.env.PAYMENT_LISTENER_POLL_MS ?? 15_000);
  return Number.isFinite(n) && n >= 3_000 ? Math.floor(n) : 15_000;
}

export const PAYMENT_LISTENER_STATE_ID = "bsc-usdt";
