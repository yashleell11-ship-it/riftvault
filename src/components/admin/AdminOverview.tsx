"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Wallet, ImageIcon, Gift, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type Stats = { users: number; pendingWithdrawals: number; nfts: number; activeCampaigns: number; totalVolume: number };

export function AdminOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== "admin") { router.replace("/dashboard"); return; }
    });
    fetch("/api/admin/analytics").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d.summary); });
  }, [router]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <Badge variant="accent" className="mb-3">Admin Panel</Badge>
        <h1 className="font-display text-3xl font-bold mb-2">Platform Overview</h1>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: stats?.users ?? "—", icon: Users },
          { label: "Pending Withdrawals", value: stats?.pendingWithdrawals ?? "—", icon: Wallet },
          { label: "Total NFTs", value: stats?.nfts ?? "—", icon: ImageIcon },
          { label: "Active Campaigns", value: stats?.activeCampaigns ?? "—", icon: Gift },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-accent" />
              <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
            </div>
            <p className="font-display text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-gold" /><p className="text-xs text-text-muted uppercase">Total Volume</p></div>
          <p className="font-display text-2xl font-bold text-gold">{stats ? `${stats.totalVolume.toFixed(2)} USDT` : "—"}</p>
        </Card>
        <Card>
          <h3 className="font-medium mb-4 text-sm">Quick actions</h3>
          <div className="space-y-2">
            <Button href="/admin/users" variant="secondary" size="sm" className="w-full justify-start">Manage users</Button>
            <Button href="/admin/withdrawals" variant="secondary" size="sm" className="w-full justify-start">Review withdrawals</Button>
            <Button href="/admin/airdrops" variant="secondary" size="sm" className="w-full justify-start">Manage airdrops</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
