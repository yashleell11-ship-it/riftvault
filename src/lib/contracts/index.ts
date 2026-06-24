export const RIFT_VAULT_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const RIFT_VAULT_MARKETPLACE_ABI = [
  {
    type: "function",
    name: "list",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "priceWei", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buy",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "listings",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "priceWei", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export function getContractAddresses() {
  return {
    nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as `0x${string}` | undefined,
    marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as
      | `0x${string}`
      | undefined,
  };
}

/** Convert display price in ETH to wei for on-chain listings */
export function ethToWei(eth: number): bigint {
  return BigInt(Math.round(eth * 1e18));
}

export function weiToEth(wei: bigint): number {
  return Number(wei) / 1e18;
}
