"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Coins,
  Copy,
  Gift,
  Link2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LEVEL_THRESHOLDS, levelLabel } from "@/lib/levels";
import { formatPrice } from "@/lib/currency";
import { RvltSection } from "@/components/earn/RvltSection";

type Summary = {
  totalEarned: number;
  tradingRewards: number;
  referralRewards: number;
  tradeCount: number;
  level: number;
  levelProgress: {
    currentLevel: number;
    nextLevel: number | null;
    tradeCount: number;
    tradesForNext: number | null;
    progress: number;
    tradesRemaining: number;
  };
  breakdown: { type: string; label: string; amount: number }[];
  defaultCurrency: string;
};

type Referral = {
  referralCode: string;
  referralLink: string;
  teamCount: number;
};

type HistoryItem = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  order: {
    id: string;
    price: number;
    nft: {
      id: string;
      name: string;
      imageUrl: string;
      collection: { name: string };
    };
  } | null;
};

function typeLabel(type: string) {
  return type === "referral" ? "Referral" : "Trading";
}

export function EarnDashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, referralRes, historyRes, meRes] = await Promise.all([
      fetch("/api/earn/summary"),
      fetch("/api/earn/referral"),
      fetch("/api/earn/history?limit=10"),
      fetch("/api/auth/me"),
    ]);

    if (!meRes.ok) {
      router.push("/login?redirect=/earn");
      return;
    }

    if (summaryRes.ok) setSummary(await summaryRes.json());
    if (referralRes.ok) setReferral(await referralRes.json());
    if (historyRes.ok) {
      const data = await historyRes.json();
      setHistory(data.items ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyReferralLink() {
    if (!referral?.referralLink) return;
    await navigator.clipboard.writeText(referral.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 bg-bg-hover rounded animate-pulse mb-8" />
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-bg-hover" />
          ))}
        </div>
        <Card className="h-64 animate-pulse bg-bg-hover" />
      </div>
    );
  }

  const maxBreakdown = Math.max(
    summary?.tradingRewards ?? 0,
    summary?.referralRewards ?? 0,
    0.001
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Badge variant="gold" className="mb-3">
          Rewards
        </Badge>
        <h1 className="font-display text-3xl font-bold mb-2">Earn Dashboard</h1>
        <p className="text-text-secondary max-w-2xl">
          Track trading rewards, referral commissions, and level progression from
          every completed sale on RiftVault.
        </p>
      </div>

      {referral && (
        <Card className="mb-8" shine>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
                  Your referral link
                </p>
                <p className="font-mono text-sm truncate">{referral.referralLink}</p>
                <p className="text-xs text-text-muted mt-1">
                  Code: <span className="text-text-secondary">{referral.referralCode}</span>
                  {" · "}
                  <Users className="inline h-3 w-3 -mt-0.5" /> {referral.teamCount} team member
                  {referral.teamCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyReferralLink}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy link
                </>
              )}
            </Button>
            <Button href="/dashboard/referrals" variant="ghost" size="sm" className="shrink-0">
              View team
            </Button>
          </div>
        </Card>
      )}

      {summary && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Card shine>
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-4 w-4 text-gold" />
                <p className="text-xs text-text-muted uppercase tracking-wide">Total earned</p>
              </div>
              <p className="font-display text-2xl font-bold text-gold">
                {formatPrice(summary.totalEarned, summary.defaultCurrency)}
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-accent" />
                <p className="text-xs text-text-muted uppercase tracking-wide">
                  Trading rewards
                </p>
              </div>
              <p className="font-display text-2xl font-bold">
                {formatPrice(summary.tradingRewards, summary.defaultCurrency)}
              </p>
              <p className="text-xs text-text-muted mt-1">2.5% on each sale you complete</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-accent" />
                <p className="text-xs text-text-muted uppercase tracking-wide">
                  Referral rewards
                </p>
              </div>
              <p className="font-display text-2xl font-bold">
                {formatPrice(summary.referralRewards, summary.defaultCurrency)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Platform fee share · 2 levels max (L1 1%, L2 0.5%)
              </p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <h2 className="font-display text-lg font-semibold mb-1">Level progression</h2>
              <p className="text-sm text-text-secondary mb-6">
                {summary.levelProgress.nextLevel
                  ? `${summary.levelProgress.tradesRemaining} more trade${
                      summary.levelProgress.tradesRemaining === 1 ? "" : "s"
                    } to reach ${levelLabel(summary.levelProgress.nextLevel)}`
                  : "Maximum level reached"}
              </p>

              <div className="flex items-center justify-between mb-2">
                <Badge variant="gold">{levelLabel(summary.levelProgress.currentLevel)}</Badge>
                {summary.levelProgress.nextLevel && (
                  <span className="text-xs text-text-muted">
                    {levelLabel(summary.levelProgress.nextLevel)}
                  </span>
                )}
              </div>
              <div className="h-3 rounded-full bg-bg-hover overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent transition-all"
                  style={{ width: `${summary.levelProgress.progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-muted">
                {summary.tradeCount} completed trade{summary.tradeCount === 1 ? "" : "s"}
              </p>

              <div className="mt-6 flex gap-1 items-end h-24">
                {LEVEL_THRESHOLDS.map((threshold) => {
                  const reached = summary.tradeCount >= threshold.minTrades;
                  return (
                    <div
                      key={threshold.level}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <div
                        className={`w-full rounded-t-md transition-colors ${
                          reached ? "bg-accent" : "bg-bg-hover"
                        }`}
                        style={{
                          height: `${20 + threshold.level * 12}px`,
                        }}
                      />
                      <span
                        className={`text-[10px] ${
                          reached ? "text-accent" : "text-text-muted"
                        }`}
                      >
                        {levelLabel(threshold.level)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-lg font-semibold mb-6">Earnings breakdown</h2>
              <div className="space-y-5">
                {summary.breakdown.map((row) => (
                  <div key={row.type}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-text-secondary">{row.label}</span>
                      <span className="font-medium">{formatPrice(row.amount, summary?.defaultCurrency)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.type === "referral" ? "bg-gold" : "bg-accent"
                        }`}
                        style={{ width: `${(row.amount / maxBreakdown) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-6">
                Rewards are credited automatically when a marketplace order completes.
              </p>
            </Card>
          </div>
        </>
      )}

      <div className="mb-8">
        <RvltSection />
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold mb-6">Reward history</h2>
        {history.length === 0 ? (
          <div className="text-center py-12">
            <Coins className="h-10 w-10 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary text-sm mb-4">
              No rewards yet. Complete a sale or refer a trader to start earning.
            </p>
            <Button href="/explore" variant="secondary" size="sm">
              Explore marketplace
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-3 font-medium">Artifact</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {item.order?.nft ? (
                          <>
                            <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
                              <Image
                                src={item.order.nft.imageUrl}
                                alt={item.order.nft.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.order.nft.name}</p>
                              <p className="text-xs text-text-muted truncate">
                                {item.order.nft.collection.name}
                              </p>
                            </div>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge variant={item.type === "referral" ? "gold" : "accent"}>
                        {typeLabel(item.type)}
                      </Badge>
                    </td>
                    <td className="py-4 font-medium text-accent">
                      +{formatPrice(item.amount, item.currency)}
                    </td>
                    <td className="py-4 text-text-muted hidden sm:table-cell">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
