import { http, createConfig } from "wagmi";
import { sepolia, bscTestnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(projectId
    ? [walletConnect({ projectId, showQrModal: true })]
    : []),
];

export const supportedChains = [sepolia, bscTestnet] as const;

export const wagmiConfig = createConfig({
  chains: [...supportedChains],
  connectors,
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL || undefined),
  },
  ssr: true,
});

export function getTargetChainId() {
  const id = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111", 10);
  return supportedChains.find((c) => c.id === id) ?? sepolia;
}

export function contractsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS &&
      process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS
  );
}
