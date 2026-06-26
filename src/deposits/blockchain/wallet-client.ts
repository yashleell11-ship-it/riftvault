import { createWalletClient, http, type Account, type WalletClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getBscChainId, getBscRpcUrl, getReceivingWallet } from "@/payments/blockchain/config";

let cachedTreasuryAccount: ReturnType<typeof privateKeyToAccount> | null | undefined;

export function getTreasuryPrivateKey(): `0x${string}` | null {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) return null;
  return normalized as `0x${string}`;
}

/** Hot-wallet account that funds deposit addresses with BNB (must match RECEIVING_WALLET). */
export function getTreasuryAccount(): ReturnType<typeof privateKeyToAccount> | null {
  if (cachedTreasuryAccount !== undefined) return cachedTreasuryAccount;

  const key = getTreasuryPrivateKey();
  if (!key) {
    cachedTreasuryAccount = null;
    return null;
  }

  const account = privateKeyToAccount(key);
  const receiving = getReceivingWallet();
  if (receiving && account.address.toLowerCase() !== receiving.toLowerCase()) {
    throw new Error(
      "TREASURY_PRIVATE_KEY does not match RECEIVING_WALLET — sweeper disabled for safety"
    );
  }

  cachedTreasuryAccount = account;
  return account;
}

export function createBscWalletClient(account: Account): WalletClient {
  const chainId = getBscChainId();
  const chain = chainId === bsc.id ? bsc : bscTestnet;

  return createWalletClient({
    account,
    chain,
    transport: http(getBscRpcUrl(), {
      timeout: 12_000,
      retryCount: 2,
      retryDelay: 500,
    }),
  });
}

/** Reset cached treasury account (tests / hot reload). */
export function resetTreasuryAccountCache() {
  cachedTreasuryAccount = undefined;
}
