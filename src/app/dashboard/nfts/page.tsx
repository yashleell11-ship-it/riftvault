"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageIcon, Link2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ListForSaleModal } from "@/components/marketplace/MarketplaceModals";
import { OnchainListModal } from "@/components/marketplace/OnchainListModal";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import { type NftItem } from "@/lib/types";

export default function MyNftsPage() {
  const router = useRouter();
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTarget, setListTarget] = useState<NftItem | null>(null);
  const [onchainTarget, setOnchainTarget] = useState<NftItem | null>(null);
  const [listing, setListing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [chainEnabled, setChainEnabled] = useState(false);

  const loadNfts = useCallback(() => {
    setLoading(true);
    fetch("/api/user/nfts")
      .then((r) => r.json())
      .then((d) => setNfts(d.nfts ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNfts();
    fetch("/api/chain/status").then(r => r.json()).then(d => setChainEnabled(d.enabled)).catch(() => {});
  }, [loadNfts]);

  async function handleList(price: number, currency: CurrencyCode) {
    if (!listTarget) return;
    setListing(true);
    setMessage("");

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId: listTarget.id, price, currency }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to list");
      setListing(false);
      return;
    }

    setListTarget(null);
    setListing(false);
    loadNfts();
    router.refresh();
  }

  async function handleCancelListing(nft: NftItem) {
    if (!nft.listing?.id) return;
    setActionId(nft.id);
    setMessage("");

    const res = await fetch(`/api/listings/${nft.listing.id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "Failed to cancel listing");
      setActionId(null);
      return;
    }

    setActionId(null);
    loadNfts();
    router.refresh();
  }

  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-display text-2xl font-bold mb-2">My NFTs</h1>
      <p className="text-text-secondary text-sm mb-8">
        Reserve artifacts, then list them for sale at your price.
      </p>

      {message && (
        <p className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
          {message}
        </p>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden animate-pulse">
              <div className="aspect-square bg-bg-hover" />
            </Card>
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <Card className="text-center py-16">
          <ImageIcon className="h-10 w-10 text-text-muted mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold mb-2">No NFTs yet</h2>
          <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
            Reserve from the daily pool or buy listed artifacts on Explore.
          </p>
          <div className="flex gap-3 justify-center">
            <Button href="/reserve">Go to reserve</Button>
            <Button href="/explore" variant="secondary">Explore</Button>
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nfts.map((nft) => (
            <Card key={nft.id} className="p-0 overflow-hidden">
              <Link href={`/explore/${nft.id}`}>
                <div className="relative aspect-square">
                  <Image src={nft.imageUrl} alt={nft.name} fill className="object-cover" sizes="33vw" />
                </div>
              </Link>
              <div className="p-4">
                <p className="text-xs text-text-muted">{nft.collection.name}</p>
                <h3 className="font-medium truncate">{nft.name}</h3>
                <div className="flex items-center justify-between mt-2 mb-3">
                  <Badge variant="default" className="capitalize">{nft.status}</Badge>
                  {nft.listing?.status === "active" && (
                    <span className="text-sm text-accent">{formatPrice(nft.listing.price, nft.listing.currency)}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {nft.status === "reserved" && (
                    <Button size="sm" className="w-full" onClick={() => setListTarget(nft)}>
                      List for sale
                    </Button>
                  )}

                  {chainEnabled && nft.chainTokenId && nft.status !== "listed" && (
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setOnchainTarget(nft)}>
                      <Link2 className="h-3.5 w-3.5" />List on-chain (ETH)
                    </Button>
                  )}

                  {nft.status === "listed" && nft.listing?.status === "active" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={actionId === nft.id}
                      onClick={() => handleCancelListing(nft)}
                    >
                      {actionId === nft.id ? "Cancelling..." : "Cancel listing"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ListForSaleModal
        nft={listTarget}
        open={!!listTarget}
        onClose={() => setListTarget(null)}
        onConfirm={handleList}
        loading={listing}
      />

      <OnchainListModal
        nft={onchainTarget}
        open={!!onchainTarget}
        onClose={() => setOnchainTarget(null)}
        onSuccess={() => { setOnchainTarget(null); loadNfts(); }}
      />
    </div>
  );
}
