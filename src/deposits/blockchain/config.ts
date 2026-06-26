/**
 * Unique deposit address configuration.
 * Uses HD derivation from DEPOSIT_MNEMONIC — never expose mnemonic to clients.
 */

export const DEPOSIT_BSC_CHAIN_KEY = "bsc";

/** Supported deposit routes (extend for multi-chain later). */
export const DEPOSIT_ROUTES = [
  { chainKey: DEPOSIT_BSC_CHAIN_KEY, asset: "USDT" as const },
] as const;

export function getDepositMnemonic(): string | null {
  const mnemonic = process.env.DEPOSIT_MNEMONIC?.trim();
  if (!mnemonic || mnemonic.split(" ").length < 12) return null;
  return mnemonic;
}

export function isDepositDerivationConfigured(): boolean {
  return Boolean(getDepositMnemonic());
}

export function getDepositRequiredConfirmations(): number {
  const n = Number(process.env.PAYMENT_CONFIRMATIONS ?? process.env.DEPOSIT_CONFIRMATIONS ?? 12);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

export const DEPOSIT_LISTENER_STATE_ID = "bsc-usdt-deposits";
