export type Chain = {
  id: number;
  key: string;
  name: string;
  shortName: string;
  rpc: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorerUrl: string;
  usdtAddress: string | null;
  testnet: boolean;
};

export const CHAINS: Chain[] = [
  {
    id: 11155111,
    key: "sepolia",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.sepolia.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    explorerUrl: "https://sepolia.etherscan.io",
    usdtAddress: null,
    testnet: true,
  },
  {
    id: 97,
    key: "bsc-testnet",
    name: "BNB Testnet",
    shortName: "BSC Test",
    rpc: process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    explorerUrl: "https://testnet.bscscan.com",
    usdtAddress: null,
    testnet: true,
  },
  {
    id: 80002,
    key: "polygon-amoy",
    name: "Polygon Amoy",
    shortName: "Amoy",
    rpc: "https://rpc-amoy.polygon.technology",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    explorerUrl: "https://amoy.polygonscan.com",
    usdtAddress: null,
    testnet: true,
  },
];

export function getChainByKey(key: string): Chain | undefined {
  return CHAINS.find(c => c.key === key);
}

export function getDefaultChain(): Chain {
  return CHAINS[0];
}
