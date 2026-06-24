"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type Analytics = {
  summary: { users: number; nfts: number; pendingWithdrawals: number; activeCampaigns: number; totalVolume: number; totalOrders: number };
  ordersPerDay: { date: string; count: number }[];
  topCollections: { id: string; name: string; floorPrice: number; _count: { nfts: number } }[];
};

export function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics").then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="max-w-5xl mx-auto"><div className="h-96 animate-pulse bg-bg-hover rounded-2xl" /></div>;
  if (!data) return <div className="text-text-muted text-center py-12">Failed to load analytics.</div>;

  const maxOrders = Math.max(...data.ordersPerDay.map(d => d.count), 1);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6"><Badge variant="accent" className="mb-2">Admin</Badge><h1 className="font-display text-2xl font-bold">Platform Analytics</h1></div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Volume", value: `${data.summary.totalVolume.toFixed(2)} USDT` },
          { label: "Total Orders", value: data.summary.totalOrders },
          { label: "Total Users", value: data.summary.users },
          { label: "NFTs in System", value: data.summary.nfts },
          { label: "Pending Withdrawals", value: data.summary.pendingWithdrawals },
          { label: "Active Campaigns", value: data.summary.activeCampaigns },
        ].map(({ label, value }) => (
          <Card key={label}>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-2">{label}</p>
            <p className="font-display text-xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display text-base font-semibold mb-4">Orders — Last 14 Days</h2>
          <div className="flex items-end gap-1 h-32">
            {data.ordersPerDay.map(({ date, count }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute bottom-full mb-1 text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{count}</div>
                <div className="w-full rounded-t bg-accent transition-all" style={{ height: `${(count / maxOrders) * 100}%`, minHeight: count > 0 ? "4px" : "0" }} />
                <span className="text-[8px] text-text-muted">{date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold mb-4">Top Collections by Floor</h2>
          <div className="space-y-3">
            {data.topCollections.map((col, i) => (
              <div key={col.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-4">{i + 1}</span>
                  <span className="text-sm font-medium">{col.name}</span>
                  <span className="text-xs text-text-muted">({col._count.nfts} NFTs)</span>
                </div>
                <span className="text-sm text-accent font-medium">{col.floorPrice} USDT</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
