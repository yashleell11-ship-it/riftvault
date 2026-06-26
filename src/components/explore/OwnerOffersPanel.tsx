"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";

type OfferRow = {
  id: string;
  amount: number;
  currency: string;
  expiresAt: string;
  buyer: { id: string; displayName: string };
};

export function OwnerOffersPanel({ nftId }: { nftId: string }) {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/offers?nftId=${encodeURIComponent(nftId)}`);
    if (res.ok) {
      const data = await res.json();
      setOffers(data.offers ?? []);
    }
    setLoading(false);
  }, [nftId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(offerId: string, action: "accept" | "reject") {
    setActing(offerId);
    setError("");
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setActing(null);
    if (!res.ok) {
      setError(data.error ?? "Action failed");
      return;
    }
    await load();
    router.refresh();
  }

  if (loading) return null;
  if (offers.length === 0) return null;

  return (
    <Card className="mb-6">
      <h3 className="font-display font-semibold mb-3">Pending offers</h3>
      <ul className="space-y-3">
        {offers.map((offer) => (
          <li
            key={offer.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated p-3"
          >
            <div>
              <p className="font-medium">{offer.buyer.displayName}</p>
              <p className="text-sm text-accent">{formatPrice(offer.amount, offer.currency)}</p>
              <p className="text-xs text-text-muted">
                Expires {new Date(offer.expiresAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={acting !== null}
                onClick={() => handleAction(offer.id, "accept")}
              >
                {acting === offer.id ? "…" : "Accept"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={acting !== null}
                onClick={() => handleAction(offer.id, "reject")}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </Card>
  );
}
