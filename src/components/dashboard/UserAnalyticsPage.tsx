"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ArrowDownToLine } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";

type Analytics = { totalSpent: number; totalEarned: number; totalRewards: number; tradingRewards: number; referralRewards: number; pnl: number; ownedNfts: number; totalTrades: number; buyCount: number; sellCount: number; rvltBalance: number };

export function UserAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/analytics").then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6"><div className="h-96 animate-pulse bg-bg-hover rounded-2xl" /></div>;
  if (!data) return <div className="text-text-muted text-center py-12">Failed to load analytics.</div>;

  const pnlPositive = data.pnl >= 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Badge variant="gold" className="mb-3">My Analytics</Badge>
          <h1 className="font-display text-3xl font-bold mb-2">P&amp;L Overview</h1>
          <p className="text-text-muted text-sm">Lifetime trading performance and reward history.</p>
        </div>
        <Button href="/api/user/orders/export?format=csv" variant="secondary" size="sm">
          <ArrowDownToLine className="h-4 w-4" />Export CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Spent", value: formatPrice(data.totalSpent), sub: `${data.buyCount} buys` },
          { label: "Total Sales", value: formatPrice(data.totalEarned), sub: `${data.sellCount} sells` },
          { label: "Total Rewards", value: formatPrice(data.totalRewards), sub: "Trading + referral" },
          { label: "NFTs Owned", value: data.ownedNfts, sub: `${data.totalTrades} lifetime trades` },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-2">{label}</p>
            <p className="font-display text-xl font-bold">{value}</p>
            <p className="text-xs text-text-muted mt-1">{sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card shine>
          <div className="flex items-center gap-2 mb-3">
            {pnlPositive ? <TrendingUp className="h-5 w-5 text-accent" /> : <TrendingDown className="h-5 w-5 text-danger" />}
            <p className="text-xs text-text-muted uppercase tracking-wide">Lifetime P&amp;L</p>
          </div>
          <p className={`font-display text-3xl font-bold ${pnlPositive ? "text-accent" : "text-danger"}`}>
            {pnlPositive ? "+" : ""}{formatPrice(data.pnl)}
          </p>
          <p className="text-xs text-text-muted mt-2">Sales + Rewards − Purchases</p>
        </Card>

        <Card>
          <h3 className="font-display text-base font-semibold mb-4">Rewards Breakdown</h3>
          <div className="space-y-4">
            {[
              { label: "Trading rewards", value: data.tradingRewards, color: "bg-accent" },
              { label: "Referral commissions", value: data.referralRewards, color: "bg-gold" },
            ].map(({ label, value, color }) => {
              const pct = data.totalRewards > 0 ? (value / data.totalRewards) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-medium">{formatPrice(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-display text-base font-semibold mb-4">RVLT Token Balance</h3>
        <p className="font-display text-2xl font-bold text-gold">{data.rvltBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} RVLT</p>
        <p className="text-xs text-text-muted mt-1">Utility token — <a href="/earn" className="text-accent hover:underline">stake on the Earn page</a></p>
      </Card>
    </div>
  );
}
