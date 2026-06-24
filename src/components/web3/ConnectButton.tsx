"use client";

import { useConnection, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/Button";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const { address, isConnected } = useConnection();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        size={size}
        onClick={() => disconnect()}
        title={address}
      >
        {truncateAddress(address)}
      </Button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <Button
      variant="secondary"
      size={size}
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}
