import { createPublicClient, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { getBscChainId, getBscRpcUrl } from "@/payments/blockchain/config";

let cachedClient: PublicClient | null = null;

export function getBscPublicClient(): PublicClient {
  if (cachedClient) return cachedClient;

  const chainId = getBscChainId();
  const chain = chainId === bsc.id ? bsc : bscTestnet;

  cachedClient = createPublicClient({
    chain,
    transport: http(getBscRpcUrl(), {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1_000,
    }),
  });

  return cachedClient;
}

/** Reset client after RPC URL change (tests / hot reload). */
export function resetBscPublicClient() {
  cachedClient = null;
}
