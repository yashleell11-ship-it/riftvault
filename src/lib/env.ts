/** True on Vercel production or NODE_ENV=production. */
export function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/** Demo self-credit deposits — local dev only unless explicitly enabled. */
export function allowDemoDeposits() {
  if (process.env.ALLOW_DEMO_DEPOSITS === "true") return true;
  return !isProduction();
}

export {
  getDepositMnemonic,
  isDepositDerivationConfigured,
  isUniqueDepositAddressesEnabled as uniqueDepositAddressesEnabled,
} from "@/deposits/blockchain/config";
