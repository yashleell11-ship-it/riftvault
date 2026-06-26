"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/web3/ConnectButton";
import { formatPrice } from "@/lib/currency";
import {
  RIFT_VAULT_MARKETPLACE_ABI,
  ethToWei,
  getContractAddresses,
} from "@/lib/contracts";

type NftActionsProps = {
  nftId: string;
  status: string;
  price: number | null;
  currency: string | null;
  isOwner: boolean;
  listingId: string | null;
  chainListingId: string | null;
  loggedIn: boolean;
};

export function NftActions({
  nftId,
  status,
  price,
  currency,
  isOwner,
  listingId,
  chainListingId,
  loggedIn,
}: NftActionsProps) {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [chainEnabled, setChainEnabled] = useState(false);
  const [usdtEnabled, setUsdtEnabled] = useState(false);

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    fetch("/api/chain/status")
      .then((r) => r.json())
      .then((d) => setChainEnabled(d.enabled));
    fetch("/api/payments/usdt/create")
      .then((r) => r.json())
      .then((d) => setUsdtEnabled(Boolean(d.enabled)));
  }, []);

  useEffect(() => {
    if (!isConfirmed || !txHash) return;

    async function sync() {
      setLoading(true);
      const res = await fetch("/api/orders/buy-onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nftId, txHash, buyerAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Sync failed — contact support with tx hash");
        setLoading(false);
        return;
      }
      router.push("/dashboard/nfts");
      router.refresh();
    }

    sync();
  }, [isConfirmed, txHash, nftId, router]);

  async function handleBuyBalance() {
    if (!loggedIn) {
      router.push(`/login?redirect=/explore/${nftId}`);
      return;
    }

    setLoading(true);
    setMessage("");
    const res = await fetch("/api/orders/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Purchase failed");
      setLoading(false);
      return;
    }
    router.push("/dashboard/nfts");
    router.refresh();
  }

  async function handleBuyUsdt() {
    if (!loggedIn) {
      router.push(`/login?redirect=/explore/${nftId}`);
      return;
    }

    setLoading(true);
    setMessage("");
    const res = await fetch("/api/payments/usdt/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "Could not start USDT checkout");
      return;
    }

    router.push(data.checkoutUrl);
  }

  async function handleBuyOnChain() {
    if (!loggedIn) {
      router.push(`/login?redirect=/explore/${nftId}`);
      return;
    }
    if (!isConnected || !address) {
      setMessage("Connect MetaMask below to pay on-chain.");
      return;
    }
    if (!chainListingId) {
      setMessage("No on-chain listing ID for this artifact.");
      return;
    }

    const { marketplace } = getContractAddresses();
    if (!marketplace) {
      setMessage("Marketplace contract not configured.");
      return;
    }

    setMessage("");
    const valueWei =
      currency === "ETH" && price != null
        ? ethToWei(price)
        : price != null
          ? parseEther(String(price))
          : 0n;

    writeContract({
      address: marketplace,
      abi: RIFT_VAULT_MARKETPLACE_ABI,
      functionName: "buy",
      args: [BigInt(chainListingId)],
      value: valueWei,
    });
  }

  async function handleCancelListing() {
    if (!listingId) return;
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/listings/${listingId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Cancel failed");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  const busy = loading || isWriting || isConfirming;

  if (status === "listed" && price != null) {
    if (isOwner) {
      return (
        <div className="w-full space-y-3">
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleCancelListing}
            disabled={busy}
          >
            {busy ? "Cancelling..." : "Cancel listing"}
          </Button>
          {message && <p className="text-sm text-danger">{message}</p>}
        </div>
      );
    }

    const canOnChain = chainEnabled && chainListingId && currency === "ETH";
    const canUsdt = usdtEnabled && currency === "USDT";

    return (
      <div className="w-full space-y-3">
        <Button size="lg" className="w-full" onClick={handleBuyBalance} disabled={busy}>
          {busy ? "Processing..." : `Pay from balance · ${formatPrice(price, currency)}`}
        </Button>
        {canUsdt && (
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={handleBuyUsdt}
            disabled={busy}
          >
            {busy ? "Starting checkout…" : `Pay with USDT (BEP20) · ${formatPrice(price, currency)}`}
          </Button>
        )}
        {canOnChain && (
          <>
            <ConnectButton size="md" />
            <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={handleBuyOnChain}
            disabled={busy}
          >
            {isWriting || isConfirming
              ? "Confirm in wallet…"
              : `Pay with wallet (ETH) · ${formatPrice(price, currency)}`}
            </Button>
          </>
        )}
        <Button href="/reserve" variant="secondary" size="lg" className="w-full">
          Reserve from pool
        </Button>
        {message && <p className="text-sm text-danger">{message}</p>}
        {txHash && isConfirming && (
          <p className="text-xs text-text-muted">Waiting for on-chain confirmation…</p>
        )}
      </div>
    );
  }

  if (status === "available") {
    return (
      <Button href={loggedIn ? "/reserve" : `/login?redirect=/reserve`} size="lg" className="w-full">
        Reserve this artifact
      </Button>
    );
  }

  if (status === "reserved" && isOwner) {
    return (
      <Button href="/dashboard/nfts" size="lg" className="w-full">
        List for sale in dashboard
      </Button>
    );
  }

  if (!loggedIn) {
    return (
      <Button href={`/login?redirect=/explore/${nftId}`} size="lg" className="w-full">
        Log in to trade
      </Button>
    );
  }

  return (
    <p className="text-sm text-text-secondary w-full text-center py-2">
      This artifact is not available for trade.
    </p>
  );
}
