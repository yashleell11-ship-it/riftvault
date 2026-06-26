/**
 * Unique deposit address configuration.
 * Uses HD derivation from DEPOSIT_MNEMONIC — never expose mnemonic to clients.
 */

export const DEPOSIT_BSC_CHAIN_KEY = "bsc";

/** Supported deposit routes (extend for multi-chain later). */
export const DEPOSIT_ROUTES = [
  { chainKey: DEPOSIT_BSC_CHAIN_KEY, asset: "USDT" as const },
] as const;

/** Accept `true`, `TRUE`, `1`, and surrounding whitespace (common in Vercel env UI). */
export function isEnvFlagEnabled(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Parse DEPOSIT_MNEMONIC from env — handles newlines, extra spaces, and wrapping quotes
 * (Vercel often stores pasted mnemonics as multi-line secrets).
 */
export function parseDepositMnemonic(raw: string | undefined): string | null {
  if (!raw) return null;

  const stripped = raw.trim().replace(/^["']|["']$/g, "");
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length < 12) return null;

  return words.join(" ");
}

export function getDepositMnemonic(): string | null {
  return parseDepositMnemonic(process.env.DEPOSIT_MNEMONIC);
}

export function isDepositDerivationConfigured(): boolean {
  return Boolean(getDepositMnemonic());
}

export function isUniqueDepositAddressesEnabled(): boolean {
  return isEnvFlagEnabled("ENABLE_UNIQUE_DEPOSIT_ADDRESSES") && isDepositDerivationConfigured();
}

export function getDepositRequiredConfirmations(): number {
  const n = Number(process.env.PAYMENT_CONFIRMATIONS ?? process.env.DEPOSIT_CONFIRMATIONS ?? 12);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

export const DEPOSIT_LISTENER_STATE_ID = "bsc-usdt-deposits";
/** @deprecated Unified listener uses PAYMENT_LISTENER_STATE_ID only. */
export const DEPOSIT_ADDRESS_ROTATION_STATE_ID = "bsc-usdt-deposit-rotate";

export function getDepositScanMaxAddressesPerTick(): number {
  const n = Number(process.env.DEPOSIT_SCAN_MAX_ADDRESSES ?? 8);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 8;
}
