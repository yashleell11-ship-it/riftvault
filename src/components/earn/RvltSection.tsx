"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Lock, Unlock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Stake = { id: string; amount: number; stakedAt: string };

type TokenBalance = {
  available: number;
  staked: number;
  total: number;
  activeStakes: Stake[];
  contractAddress: string | null;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function RvltSection() {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/token/balance");
    if (res.ok) setBalance(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStake(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(stakeInput);
    if (!amount || amount <= 0) return;
    setActionLoading("stake");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/token/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stake failed");
      setMessage(`Staked ${fmt(amount)} RVLT successfully.`);
      setStakeInput("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stake failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnstake(stakeId: string, amount: number) {
    setActionLoading(stakeId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/token/unstake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unstake failed");
      setMessage(`Unstaked ${fmt(amount)} RVLT successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unstake failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <Card className="h-48 animate-pulse bg-bg-hover" />;
  }

  const b = balance ?? { available: 0, staked: 0, total: 0, activeStakes: [], contractAddress: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="accent" className="text-xs">BETA</Badge>
        <h2 className="font-display text-xl font-semibold">RVLT — Platform Token</h2>
      </div>
      <p className="text-sm text-text-muted max-w-2xl">
        RVLT is RiftVault&apos;s utility token. Stake to signal loyalty and unlock governance voting.
        Staking does not guarantee financial returns — this is a utility mechanism only.{" "}
        <Link href="/governance" className="text-accent hover:text-accent-dim">
          Open governance →
        </Link>
      </p>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          {message}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card shine>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-gold" />
            <p className="text-xs text-text-muted uppercase tracking-wide">Total RVLT</p>
          </div>
          <p className="font-display text-2xl font-bold text-gold">{fmt(b.total)}</p>
          <p className="text-xs text-text-muted mt-1">RVLT</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-accent" />
            <p className="text-xs text-text-muted uppercase tracking-wide">Available</p>
          </div>
          <p className="font-display text-2xl font-bold">{fmt(b.available)}</p>
          <p className="text-xs text-text-muted mt-1">Ready to stake</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-text-muted" />
            <p className="text-xs text-text-muted uppercase tracking-wide">Staked</p>
          </div>
          <p className="font-display text-2xl font-bold">{fmt(b.staked)}</p>
          <p className="text-xs text-text-muted mt-1">Locked for loyalty</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-display text-base font-semibold mb-4">Stake RVLT</h3>
          <form onSubmit={handleStake} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wide mb-2">
                Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 h-10 rounded-xl border border-border bg-bg-hover px-3 text-sm focus:border-accent/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setStakeInput(String(b.available))}
                  className="text-xs text-accent hover:text-accent-dim px-3"
                >
                  MAX
                </button>
              </div>
              {b.available > 0 && (
                <p className="text-xs text-text-muted mt-1">
                  Available: {fmt(b.available)} RVLT
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={
                actionLoading === "stake" ||
                !stakeInput ||
                parseFloat(stakeInput) <= 0 ||
                parseFloat(stakeInput) > b.available
              }
            >
              <Lock className="h-4 w-4" />
              {actionLoading === "stake" ? "Staking…" : "Stake RVLT"}
            </Button>
          </form>
          <p className="text-xs text-text-muted mt-4 border-t border-border pt-4">
            Staking is for loyalty signaling only. Unstake at any time — no lockup period.
          </p>
        </Card>

        <Card>
          <h3 className="font-display text-base font-semibold mb-4">Active Stakes</h3>
          {b.activeStakes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Lock className="h-8 w-8 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">No active stakes yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Stake RVLT to build your loyalty record.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {b.activeStakes.map((stake) => (
                <div
                  key={stake.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-bg-hover border border-border px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm">{fmt(stake.amount)} RVLT</p>
                    <p className="text-xs text-text-muted">
                      Staked {new Date(stake.stakedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnstake(stake.id, stake.amount)}
                    disabled={actionLoading === stake.id}
                  >
                    <Unlock className="h-4 w-4" />
                    {actionLoading === stake.id ? "…" : "Unstake"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {b.contractAddress && (
            <p className="text-xs text-text-muted mt-4 border-t border-border pt-4 font-mono truncate">
              Contract: {b.contractAddress}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
