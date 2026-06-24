import { createPublicClient, decodeEventLog, http, type Hash } from "viem";
import { getTargetChainId } from "@/lib/wagmi";
import {
  RIFT_VAULT_MARKETPLACE_ABI,
  getContractAddresses,
} from "@/lib/contracts";

export async function verifyMarketplacePurchase(
  txHash: Hash,
  expectedListingId: bigint,
  buyerAddress: string
) {
  const { marketplace } = getContractAddresses();
  if (!marketplace) {
    throw new Error("Marketplace contract not configured");
  }

  const chain = getTargetChainId();
  const client = createPublicClient({
    chain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
  });

  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted");
  }

  const tx = await client.getTransaction({ hash: txHash });
  if (tx.from.toLowerCase() !== buyerAddress.toLowerCase()) {
    throw new Error("Buyer address mismatch");
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== marketplace.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: RIFT_VAULT_MARKETPLACE_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === "Sold" &&
        decoded.args.listingId === expectedListingId
      ) {
        return { listingId: expectedListingId, buyer: decoded.args.buyer };
      }
    } catch {
      // not our event
    }
  }

  throw new Error("Sold event not found in transaction");
}

export function isChainPaymentsEnabled() {
  const { nft, marketplace } = getContractAddresses();
  return Boolean(nft && marketplace && process.env.NEXT_PUBLIC_RPC_URL);
}
