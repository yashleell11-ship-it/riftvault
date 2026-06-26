import { mnemonicToAccount } from "viem/accounts";
import { getDepositMnemonic } from "@/deposits/blockchain/config";

/** HD account for signing from a user deposit address (m/44'/60'/0'/0/{index}). */
export function deriveDepositAccount(derivationIndex: number) {
  const mnemonic = getDepositMnemonic();
  if (!mnemonic) {
    throw new Error("DEPOSIT_MNEMONIC is not configured");
  }

  return mnemonicToAccount(mnemonic, {
    addressIndex: derivationIndex,
  });
}
