import { mnemonicToAccount } from "viem/accounts";
import { getDepositMnemonic } from "@/deposits/blockchain/config";

/**
 * Derive a unique EVM deposit address (BIP44 path m/44'/60'/0'/0/{index}).
 * Same address receives all BEP20 tokens on BNB Smart Chain.
 */
export function deriveDepositAddress(derivationIndex: number): `0x${string}` {
  const mnemonic = getDepositMnemonic();
  if (!mnemonic) {
    throw new Error("DEPOSIT_MNEMONIC is not configured");
  }

  const account = mnemonicToAccount(mnemonic, {
    addressIndex: derivationIndex,
  });

  return account.address;
}
