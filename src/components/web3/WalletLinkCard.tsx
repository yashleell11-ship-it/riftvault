"use client";

import { useEffect, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConnectButton } from "@/components/web3/ConnectButton";

export function WalletLinkCard({
  linkedAddress,
  onLinked,
}: {
  linkedAddress: string | null;
  onLinked: (address: string) => void;
}) {
  const { address, isConnected } = useConnection();
  const { signMessageAsync, isPending } = useSignMessage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage("");
  }, [address]);

  async function linkWallet() {
    if (!address) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/wallet/nonce");
      const { nonce } = await res.json();
      const text = `Link wallet to RiftVault\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message: text });

      const linkRes = await fetch("/api/user/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message: text }),
      });

      const data = await linkRes.json();
      if (!linkRes.ok) {
        setMessage(data.error ?? "Link failed");
        return;
      }

      onLinked(data.user.walletAddress);
      setMessage("Wallet linked to your account.");
    } catch {
      setMessage("Signature rejected or link failed.");
    } finally {
      setLoading(false);
    }
  }

  const displayLinked = linkedAddress || (isConnected ? address : null);

  return (
    <Card className="mb-6">
      <h2 className="font-medium mb-1">Crypto wallet</h2>
      <p className="text-sm text-text-secondary mb-4">
        Connect MetaMask and link your address for on-chain purchases (Phase 12–14).
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <ConnectButton size="md" />
        {isConnected && address && address.toLowerCase() !== linkedAddress?.toLowerCase() && (
          <Button onClick={linkWallet} disabled={loading || isPending}>
            {loading ? "Linking…" : "Link to account"}
          </Button>
        )}
      </div>

      {displayLinked && (
        <p className="text-sm font-mono text-accent break-all">
          Linked: {displayLinked}
        </p>
      )}

      {message && (
        <p
          className={`text-sm mt-3 ${message.includes("linked") ? "text-accent" : "text-danger"}`}
        >
          {message}
        </p>
      )}
    </Card>
  );
}
