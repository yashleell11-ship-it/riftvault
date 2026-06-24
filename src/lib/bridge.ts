export type BridgeRoute = {
  id: string;
  fromChain: string;
  toChain: string;
  token: string;
  minAmount: number;
  etaMinutes: number;
  note: string;
};

export const BRIDGE_ROUTES: BridgeRoute[] = [
  {
    id: "eth-sepolia-bsc",
    fromChain: "ethereum-sepolia",
    toChain: "bsc-testnet",
    token: "ETH",
    minAmount: 0.01,
    etaMinutes: 15,
    note: "Use an external bridge (e.g. LayerZero, Stargate). RiftVault tracks intent only.",
  },
  {
    id: "bsc-eth-sepolia",
    fromChain: "bsc-testnet",
    toChain: "ethereum-sepolia",
    token: "BNB",
    minAmount: 0.05,
    etaMinutes: 20,
    note: "Bridge via official BSC bridge or third-party aggregator.",
  },
  {
    id: "polygon-eth",
    fromChain: "polygon-amoy",
    toChain: "ethereum-sepolia",
    token: "MATIC",
    minAmount: 1,
    etaMinutes: 10,
    note: "Polygon PoS bridge — confirm destination chain in wallet.",
  },
];

export function findBridgeRoute(fromChain: string, toChain: string, token: string) {
  return BRIDGE_ROUTES.find(
    (r) =>
      r.fromChain === fromChain &&
      r.toChain === toChain &&
      r.token.toUpperCase() === token.toUpperCase()
  );
}
