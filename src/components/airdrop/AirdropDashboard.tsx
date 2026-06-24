"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/currency";
import { levelLabel } from "@/lib/levels";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tokenAmount: number;
  currency: string;
  minLevel: number;
  requiresEmailVerified: boolean;
  maxClaims: number | null;
  claimCount: number;
  startsAt: string;
  endsAt: string | null;
  eligible: boolean;
  eligibilityReason?: string;
  claimed: boolean;
};

type ClaimRecord = {
  id: string;
  amount: number;
  currency: string;
  claimedAt: string;
  campaign: { name: string; slug: string };
};

export function AirdropDashboard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [campRes, meRes] = await Promise.all([
      fetch("/api/airdrop/campaigns"),
      fetch("/api/auth/me"),
    ]);

    setSignedIn(meRes.ok);
    if (campRes.ok) {
      const data = await campRes.json();
      setCampaigns(data.campaigns ?? []);
      setClaimHistory(data.claimHistory ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClaim(campaignId: string) {
    if (!signedIn) {
      router.push("/login?redirect=/airdrop");
      return;
    }

    setClaimingId(campaignId);
    const res = await fetch("/api/airdrop/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    setClaimingId(null);

    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Claim failed");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-56 bg-bg-hover rounded animate-pulse mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-bg-hover" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <Badge variant="gold" className="mb-3">
          Seasonal drops
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">Airdrop Campaigns</h1>
        <p className="text-text-secondary max-w-lg mx-auto">
          Claim platform rewards when you meet each campaign&apos;s eligibility rules. Tokens credit
          to your internal wallet instantly.
        </p>
      </div>

      <div className="space-y-5 mb-12">
        {campaigns.length === 0 ? (
          <Card className="text-center py-16">
            <Gift className="h-10 w-10 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary">No active campaigns right now. Check back soon.</p>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id} shine={campaign.eligible && !campaign.claimed}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h2 className="font-display text-xl font-semibold">{campaign.name}</h2>
                    {campaign.claimed && (
                      <Badge variant="accent">
                        <Check className="h-3 w-3 mr-1" /> Claimed
                      </Badge>
                    )}
                    {!campaign.claimed && campaign.eligible && (
                      <Badge variant="gold">Eligible</Badge>
                    )}
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-text-secondary mb-3">{campaign.description}</p>
                  )}
                  <p className="font-display text-2xl font-bold text-gold mb-3">
                    {formatPrice(campaign.tokenAmount, campaign.currency)}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                    <span>Min level: {levelLabel(campaign.minLevel)}</span>
                    {campaign.requiresEmailVerified && <span>Email verified required</span>}
                    {campaign.maxClaims != null && (
                      <span>
                        {campaign.claimCount}/{campaign.maxClaims} claims
                      </span>
                    )}
                    <span>
                      Ends:{" "}
                      {campaign.endsAt
                        ? new Date(campaign.endsAt).toLocaleDateString()
                        : "Open-ended"}
                    </span>
                  </div>
                  {!campaign.claimed && !campaign.eligible && campaign.eligibilityReason && (
                    <p className="text-xs text-text-muted mt-3">{campaign.eligibilityReason}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {campaign.claimed ? (
                    <Button variant="secondary" size="sm" disabled>
                      Claimed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={campaign.eligible ? "primary" : "secondary"}
                      disabled={!campaign.eligible || claimingId === campaign.id}
                      onClick={() => handleClaim(campaign.id)}
                    >
                      {claimingId === campaign.id
                        ? "Claiming..."
                        : signedIn
                          ? "Claim now"
                          : "Sign in to claim"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {claimHistory.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold mb-6">Claim history</h2>
          <div className="space-y-3">
            {claimHistory.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="font-medium">{claim.campaign.name}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(claim.claimedAt).toLocaleString()}
                  </p>
                </div>
                <p className="font-medium text-accent">
                  +{formatPrice(claim.amount, claim.currency)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
