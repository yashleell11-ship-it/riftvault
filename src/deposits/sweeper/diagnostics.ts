import { formatUnits } from "viem";
import { isEnvFlagEnabled, getDepositMnemonic } from "@/deposits/blockchain/config";
import {
  getTreasuryPrivateKey,
  getTreasuryDerivedAddress,
} from "@/deposits/blockchain/wallet-client";
import { getReceivingWallet } from "@/payments/blockchain/config";
import { getBscPublicClient } from "@/payments/blockchain/client";
import { SWEEP_STATUS } from "@/deposits/sweeper/config";

export type SweeperDiagnostics = {
  enabled: boolean;
  errors: string[];
  checks: {
    enableFlag: { raw: string | undefined; parsed: boolean };
    depositMnemonic: boolean;
    receivingWallet: string | null;
    treasuryKeyPresent: boolean;
    treasuryKeyFormatValid: boolean;
    treasuryDerivedAddress: string | null;
    treasuryAddressMatch: boolean;
    treasuryBnbBalance: string | null;
    bscRpcUrl: string;
  };
};

/** Full runtime validation — safe to call from routes (never throws). */
export async function getSweeperDiagnostics(): Promise<SweeperDiagnostics> {
  const errors: string[] = [];
  const enableRaw = process.env.ENABLE_DEPOSIT_SWEEPER;
  const enableParsed = isEnvFlagEnabled("ENABLE_DEPOSIT_SWEEPER");
  const mnemonic = getDepositMnemonic();
  const receiving = getReceivingWallet();
  const keyPresent = Boolean(process.env.TREASURY_PRIVATE_KEY?.trim());
  const key = getTreasuryPrivateKey();
  const treasuryDerived = key ? getTreasuryDerivedAddress(key) : null;
  const addressMatch =
    Boolean(receiving && treasuryDerived) &&
    treasuryDerived!.toLowerCase() === receiving!.toLowerCase();

  if (!enableParsed) {
    errors.push(
      `ENABLE_DEPOSIT_SWEEPER is not true (raw=${JSON.stringify(enableRaw ?? "")})`
    );
  }
  if (!mnemonic) errors.push("DEPOSIT_MNEMONIC is missing or invalid");
  if (!receiving) errors.push("RECEIVING_WALLET is missing or invalid");
  if (!keyPresent) errors.push("TREASURY_PRIVATE_KEY is not set");
  else if (!key) errors.push("TREASURY_PRIVATE_KEY format invalid (expect 64 hex chars, optional 0x)");
  else if (!addressMatch) {
    errors.push(
      `TREASURY_PRIVATE_KEY derives to ${treasuryDerived} but RECEIVING_WALLET is ${receiving}`
    );
  }

  let treasuryBnbBalance: string | null = null;
  if (receiving && errors.length === 0) {
    try {
      const client = getBscPublicClient();
      const wei = await client.getBalance({ address: receiving });
      treasuryBnbBalance = formatUnits(wei, 18);
      if (wei === 0n) {
        errors.push("Treasury BNB balance is 0 — cannot fund deposit-address gas");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to read treasury BNB balance: ${msg}`);
    }
  }

  return {
    enabled: errors.length === 0,
    errors,
    checks: {
      enableFlag: { raw: enableRaw, parsed: enableParsed },
      depositMnemonic: Boolean(mnemonic),
      receivingWallet: receiving,
      treasuryKeyPresent: keyPresent,
      treasuryKeyFormatValid: Boolean(key),
      treasuryDerivedAddress: treasuryDerived,
      treasuryAddressMatch: addressMatch,
      treasuryBnbBalance,
      bscRpcUrl: process.env.BSC_RPC_URL?.trim() || "(default publicnode)",
    },
  };
}

export function isDepositSweeperEnabledSync(): boolean {
  const enableParsed = isEnvFlagEnabled("ENABLE_DEPOSIT_SWEEPER");
  const mnemonic = getDepositMnemonic();
  const receiving = getReceivingWallet();
  const key = getTreasuryPrivateKey();
  if (!enableParsed || !mnemonic || !receiving || !key) return false;

  const derived = getTreasuryDerivedAddress(key);
  return derived?.toLowerCase() === receiving.toLowerCase();
}

export { SWEEP_STATUS };
