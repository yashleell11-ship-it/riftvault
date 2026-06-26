import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { getBscChainId, getBscRpcUrl } from "@/payments/blockchain/config";

let cachedClient: PublicClient | null = null;

const FALLBACK_BSC_RPCS = [
  "https://bsc.publicnode.com",
  "https://bsc-dataseed1.binance.org",
] as const;

function buildTransports() {
  const primary = getBscRpcUrl();
  const urls = [primary, ...FALLBACK_BSC_RPCS.filter((url) => url !== primary)];
  return urls.map((url) =>
    http(url, {
      timeout: 30_000,
      retryCount: 2,
      retryDelay: 1_000,
    })
  );
}

export function getBscPublicClient(): PublicClient {
  if (cachedClient) return cachedClient;

  const chainId = getBscChainId();
  const chain = chainId === bsc.id ? bsc : bscTestnet;

  cachedClient = createPublicClient({
    chain,
    transport: fallback(buildTransports()),
  });

  return cachedClient;
}

/** Reset client after RPC URL change (tests / hot reload). */
export function resetBscPublicClient() {
  cachedClient = null;
}
