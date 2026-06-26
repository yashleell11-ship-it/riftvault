import { createWalletClient, http, type Account, type WalletClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getBscChainId, getBscRpcUrl, getReceivingWallet } from "@/payments/blockchain/config";

let cachedTreasuryAccount: ReturnType<typeof privateKeyToAccount> | null | undefined;
let cachedTreasuryMismatch: string | null | undefined;

function stripEnvSecret(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  return stripped || null;
}

export function getTreasuryPrivateKey(): `0x${string}` | null {
  const cleaned = stripEnvSecret(process.env.TREASURY_PRIVATE_KEY);
  if (!cleaned) return null;
  const normalized = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) return null;
  return normalized as `0x${string}`;
}

export function getTreasuryDerivedAddress(key: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(key).address;
}

/** Returns mismatch detail or null when key matches RECEIVING_WALLET. */
export function getTreasuryAddressMismatch(): string | null {
  if (cachedTreasuryMismatch !== undefined) return cachedTreasuryMismatch;

  const key = getTreasuryPrivateKey();
  const receiving = getReceivingWallet();
  if (!key || !receiving) {
    cachedTreasuryMismatch = null;
    return null;
  }

  const derived = getTreasuryDerivedAddress(key);
  if (derived.toLowerCase() !== receiving.toLowerCase()) {
    cachedTreasuryMismatch = `TREASURY_PRIVATE_KEY derives to ${derived} but RECEIVING_WALLET is ${receiving}`;
    return cachedTreasuryMismatch;
  }

  cachedTreasuryMismatch = null;
  return null;
}

/** Hot-wallet account that funds deposit addresses with BNB (must match RECEIVING_WALLET). */
export function getTreasuryAccount(): ReturnType<typeof privateKeyToAccount> | null {
  if (cachedTreasuryAccount !== undefined) return cachedTreasuryAccount;

  const key = getTreasuryPrivateKey();
  if (!key) {
    cachedTreasuryAccount = null;
    return null;
  }

  const mismatch = getTreasuryAddressMismatch();
  if (mismatch) {
    cachedTreasuryAccount = null;
    return null;
  }

  cachedTreasuryAccount = privateKeyToAccount(key);
  return cachedTreasuryAccount;
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
  cachedTreasuryMismatch = undefined;
}
