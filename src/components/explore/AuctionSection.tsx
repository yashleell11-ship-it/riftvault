"use client";

import { useEffect, useState } from "react";
import { Gavel, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";

type Auction = {
  id: string;
  startingBid: number;
  highestBid: number | null;
  currency: string;
  endAt: string;
  status: string;
};

type Bid = { id: string; amount: number; createdAt: string; bidder: { displayName: string } };

function useCountdown(endAt: string) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return remaining;
}

export function AuctionSection({ nftId, loggedIn }: { nftId: string; loggedIn: boolean }) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch(`/api/auctions?nftId=${nftId}`)
      .then(r => r.ok ? r.json() : { auction: null, bids: [] })
      .then(d => { setAuction(d.auction ?? null); setBids(d.bids ?? []); })
      .finally(() => setLoading(false));
  }, [nftId]);

  const countdown = useCountdown(auction?.endAt ?? new Date(0).toISOString());

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!auction || !loggedIn) return;
    setSubmitting(true); setMsg(null);
    const res = await fetch(`/api/auctions/${auction.id}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(bidAmount) }),
    });
    const d = await res.json();
    setMsg({ text: res.ok ? "Bid placed!" : (d.error ?? "Error"), ok: res.ok });
    if (res.ok) {
      setAuction(prev => prev ? { ...prev, highestBid: parseFloat(bidAmount) } : prev);
      setBids(prev => [{ id: d.bid?.id ?? Date.now().toString(), amount: parseFloat(bidAmount), createdAt: new Date().toISOString(), bidder: { displayName: "You" } }, ...prev]);
      setBidAmount("");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="h-24 rounded-xl bg-bg-hover animate-pulse" />;
  if (!auction || auction.status !== "active") return null;

  const minBid = auction.highestBid ? auction.highestBid * 1.01 : auction.startingBid;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Gavel className="h-4 w-4 text-accent" />
        <span className="font-medium text-text-primary">Active Auction</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bg-hover p-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1"><TrendingUp className="h-3.5 w-3.5" />Current bid</div>
          <p className="font-display text-xl font-bold text-accent">
            {auction.highestBid ? formatPrice(auction.highestBid, auction.currency) : "No bids yet"}
          </p>
          {!auction.highestBid && <p className="text-xs text-text-muted">Starting: {formatPrice(auction.startingBid, auction.currency)}</p>}
        </div>
        <div className="rounded-xl bg-bg-hover p-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1"><Clock className="h-3.5 w-3.5" />Time left</div>
          <p className="font-display text-xl font-bold tabular-nums">{countdown}</p>
        </div>
      </div>

      {loggedIn ? (
        <form onSubmit={placeBid} className="flex gap-2">
          <Input
            type="number"
            placeholder={`Min ${formatPrice(minBid, auction.currency)}`}
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            min={minBid}
            step="0.01"
            className="flex-1"
            required
          />
          <Button type="submit" disabled={submitting} variant="gold">
            {submitting ? "Bidding…" : "Bid"}
          </Button>
        </form>
      ) : (
        <Button href={`/login?redirect=/explore/${nftId}`} className="w-full">Log in to bid</Button>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.text}</p>}

      {bids.length > 0 && (
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Recent bids</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {bids.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{b.bidder.displayName}</span>
                <span className="font-medium">{formatPrice(b.amount, auction.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
