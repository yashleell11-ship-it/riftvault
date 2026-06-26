/** True on Vercel production or NODE_ENV=production. */
export function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/** Demo self-credit deposits — local dev only unless explicitly enabled. */
export function allowDemoDeposits() {
  if (process.env.ALLOW_DEMO_DEPOSITS === "true") return true;
  return !isProduction();
}

/** Unique per-user deposit addresses (Phase 37). */
export function uniqueDepositAddressesEnabled() {
  if (process.env.ENABLE_UNIQUE_DEPOSIT_ADDRESSES !== "true") return false;
  const mnemonic = process.env.DEPOSIT_MNEMONIC?.trim();
  return Boolean(mnemonic && mnemonic.split(" ").length >= 12);
}

export function isDepositDerivationConfigured() {
  const mnemonic = process.env.DEPOSIT_MNEMONIC?.trim();
  return Boolean(mnemonic && mnemonic.split(" ").length >= 12);
}
