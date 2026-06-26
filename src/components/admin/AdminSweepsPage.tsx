"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet, Fuel, ArrowRightLeft, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Stats = {
  enabled: boolean;
  receivingWallet: string | null;
  treasury: { bnb: string; usdt: string };
  counts: {
    pending: number;
    completed: number;
    failed: number;
    gasFunded: number;
    refunded: number;
  };
};

type Deposit = {
  id: string;
  amount: number;
  asset: string;
  txHash: string | null;
  toAddress: string | null;
  sweepStatus: string | null;
  sweptAt: string | null;
  sweepTxHash: string | null;
  gasFundingTxHash: string | null;
  gasRefundTxHash: string | null;
  retryCount: number;
  sweepError: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string; displayName: string };
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Successful" },
  { key: "failed", label: "Failed" },
  { key: "gas", label: "Gas funding" },
] as const;

function truncateHash(hash: string | null, len = 12) {
  if (!hash) return "—";
  if (hash.length <= len * 2) return hash;
  return `${hash.slice(0, len)}…${hash.slice(-6)}`;
}

function statusBadge(status: string | null) {
  if (!status || status === "pending") {
    return <Badge variant="default">Pending</Badge>;
  }
  if (status === "completed") {
    return <Badge variant="accent">Completed</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="danger">Failed</Badge>;
  }
  return <Badge variant="default">{status}</Badge>;
}

export function AdminSweepsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, listRes] = await Promise.all([
      fetch("/api/admin/sweeps/stats"),
      fetch(`/api/admin/sweeps?filter=${filter}`),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (listRes.ok) {
      const d = await listRes.json();
      setDeposits(d.deposits);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Badge variant="accent" className="mb-2">
            Admin
          </Badge>
          <h1 className="font-display text-2xl font-bold">Treasury sweeper</h1>
          <p className="text-sm text-text-muted mt-1">
            Consolidates USDT from HD deposit addresses into RECEIVING_WALLET after wallet credit.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" /> Treasury USDT
            </div>
            <p className="font-semibold text-gold">{Number(stats.treasury.usdt).toFixed(4)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
              <Fuel className="h-3.5 w-3.5" /> Treasury BNB
            </div>
            <p className="font-semibold">{Number(stats.treasury.bnb).toFixed(6)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
              <Clock className="h-3.5 w-3.5" /> Pending sweeps
            </div>
            <p className="font-semibold">{stats.counts.pending}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </div>
            <p className="font-semibold text-accent">{stats.counts.completed}</p>
          </Card>
        </div>
      )}

      {stats && !stats.enabled && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10 text-sm text-amber-200 px-4 py-3">
          Sweeper disabled. Set ENABLE_DEPOSIT_SWEEPER=true, DEPOSIT_MNEMONIC, RECEIVING_WALLET, and
          TREASURY_PRIVATE_KEY (must match RECEIVING_WALLET).
        </Card>
      )}

      {stats && (
        <div className="flex flex-wrap gap-2 mb-4 text-xs text-text-muted">
          <span>Gas funded: {stats.counts.gasFunded}</span>
          <span>·</span>
          <span>BNB refunded: {stats.counts.refunded}</span>
          <span>·</span>
          <span className="text-red-400">Failed: {stats.counts.failed}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="h-40 animate-pulse bg-bg-hover" />
      ) : deposits.length === 0 ? (
        <Card className="text-center py-12 text-text-muted text-sm">No sweeps in this view.</Card>
      ) : (
        <div className="space-y-3">
          {deposits.map((d) => (
            <Card key={d.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{d.user.displayName}</p>
                  <p className="text-xs text-text-muted">{d.user.email}</p>
                </div>
                {statusBadge(d.sweepStatus)}
              </div>
              <p className="text-sm">
                <span className="text-gold font-semibold">
                  {d.amount} {d.asset}
                </span>
                {d.toAddress && (
                  <span className="text-text-muted text-xs ml-2 font-mono">
                    {truncateHash(d.toAddress, 8)}
                  </span>
                )}
              </p>
              <div className="grid sm:grid-cols-2 gap-1 text-xs font-mono text-text-muted">
                <p>
                  <ArrowRightLeft className="inline h-3 w-3 mr-1" />
                  Sweep: {truncateHash(d.sweepTxHash)}
                </p>
                <p>
                  <Fuel className="inline h-3 w-3 mr-1" />
                  Gas fund: {truncateHash(d.gasFundingTxHash)}
                </p>
                <p>BNB refund: {truncateHash(d.gasRefundTxHash)}</p>
                <p>Deposit tx: {truncateHash(d.txHash)}</p>
              </div>
              {d.sweepError && (
                <p className="text-xs text-red-400 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {d.sweepError}
                  {d.retryCount > 0 && ` (retries: ${d.retryCount})`}
                </p>
              )}
              {d.sweptAt && (
                <p className="text-xs text-text-muted">
                  Swept {new Date(d.sweptAt).toLocaleString()}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
