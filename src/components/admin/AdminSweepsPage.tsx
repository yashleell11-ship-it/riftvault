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
  diagnostics?: {
    enabled: boolean;
    errors: string[];
    checks: {
      enableFlag: { raw: string | undefined; parsed: boolean };
      treasuryDerivedAddress: string | null;
      treasuryAddressMatch: boolean;
      treasuryBnbBalance: string | null;
    };
  };
  treasury: { bnb: string; usdt: string };
  counts: {
    pending: number;
    completed: number;
    failed: number;
    gasFunded: number;
    refunded: number;
  };
};

type RunResult = {
  ok: boolean;
  pendingFound: number;
  gasFunded: number;
  swept: number;
  refunded: number;
  durationMs: number;
  errors: string[];
  results: {
    depositId: string;
    status: string;
    error?: string;
    gasFundingTxHash?: string | null;
    sweepTxHash?: string | null;
    gasRefundTxHash?: string | null;
  }[];
  diagnostics?: Stats["diagnostics"];
  rounds?: number;
  completed?: number;
  failed?: number;
  processed?: number;
  batchAddressesFunded?: number;
  drained?: boolean;
  remainingPending?: number;
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

function aggregatedDrained(result: RunResult) {
  return Boolean(result.drained) || (result.remainingPending ?? result.pendingFound ?? 0) === 0;
}

function statusBadge(status: string | null, sweptAt: string | null, sweepTxHash: string | null) {
  if (status === "completed") {
    return <Badge variant="accent">Completed</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="danger">Failed</Badge>;
  }
  if (sweepTxHash && sweptAt) {
    return <Badge variant="accent">Swept (finishing)</Badge>;
  }
  if (!status || status === "pending") {
    return <Badge variant="default">Pending</Badge>;
  }
  return <Badge variant="default">{status}</Badge>;
}

export function AdminSweepsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [timerSec, setTimerSec] = useState(60);

  useEffect(() => {
    if (!running) {
      setTimerSec(60);
      return;
    }
    const id = setInterval(() => {
      setTimerSec((s) => (s <= 0 ? 60 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    setRunProgress((prev) => {
      const base =
        prev?.replace(/\s\(\d{2}s\)$/, "") ?? "Funding all addresses + sweeping queue…";
      return `${base} (${String(timerSec).padStart(2, "0")}s)`;
    });
  }, [timerSec, running]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetch("/api/admin/sweeps/reconcile", { method: "POST" }).catch(() => null);
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

  async function resetFailedSweeps(depositId?: string) {
    setRunning(true);
    setRunProgress(depositId ? "Resetting deposit…" : "Resetting failed sweeps…");
    const res = await fetch("/api/admin/sweeps/reset-failed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(depositId ? { depositId } : {}),
    });
    const data = await res.json();
    setRunning(false);
    setRunProgress(null);
    if (!res.ok) {
      setRunResult({
        ok: false,
        pendingFound: 0,
        gasFunded: 0,
        swept: 0,
        refunded: 0,
        durationMs: 0,
        errors: [data.error ?? "Reset failed"],
        results: [],
      });
      return false;
    }
    await load();
    return true;
  }

  async function runSweepNow() {
    setRunning(true);
    setRunResult(null);
    setTimerSec(60);
    setRunProgress("Sweeping all deposits to treasury…");

    await fetch("/api/admin/sweeps/reconcile", { method: "POST" });
    await fetch("/api/admin/sweeps/reset-failed", { method: "POST" });

    const aggregated: RunResult = {
      ok: true,
      pendingFound: 0,
      gasFunded: 0,
      swept: 0,
      refunded: 0,
      durationMs: 0,
      errors: [],
      results: [],
      rounds: 0,
      completed: 0,
      failed: 0,
      processed: 0,
      batchAddressesFunded: 0,
      drained: false,
      remainingPending: 0,
    };

    const maxClientPasses = 5;

    for (let pass = 1; pass <= maxClientPasses; pass++) {
      setRunProgress(`Drain pass ${pass} — moving USDT to treasury…`);

      const res = await fetch("/api/admin/sweeps/run", { method: "POST" });
      const data = (await res.json()) as RunResult & {
        completed?: number;
        failed?: number;
        processed?: number;
        batchAddressesFunded?: number;
        drained?: boolean;
        remainingPending?: number;
        rounds?: number;
      };

      aggregated.rounds = (aggregated.rounds ?? 0) + (data.rounds ?? 1);
      aggregated.durationMs += data.durationMs ?? 0;
      aggregated.gasFunded += data.gasFunded ?? 0;
      aggregated.swept += data.swept ?? 0;
      aggregated.refunded += data.refunded ?? 0;
      aggregated.completed = (aggregated.completed ?? 0) + (data.completed ?? 0);
      aggregated.failed = (aggregated.failed ?? 0) + (data.failed ?? 0);
      aggregated.processed = (aggregated.processed ?? 0) + (data.processed ?? 0);
      aggregated.batchAddressesFunded =
        (aggregated.batchAddressesFunded ?? 0) + (data.batchAddressesFunded ?? 0);
      aggregated.remainingPending = data.remainingPending ?? 0;
      aggregated.drained = Boolean(data.drained);
      aggregated.pendingFound = data.remainingPending ?? 0;
      aggregated.results.push(...(data.results ?? []));
      aggregated.errors.push(...(data.errors ?? []));
      aggregated.ok = aggregated.ok && Boolean(data.ok);
      if (data.diagnostics) aggregated.diagnostics = data.diagnostics;

      setRunResult({ ...aggregated });

      if (data.drained || (data.remainingPending ?? 0) === 0) break;
      if ((data.processed ?? 0) === 0 && (data.completed ?? 0) === 0) break;
    }

    setRunProgress(null);
    setRunning(false);
    await load();
  }

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
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => resetFailedSweeps()}
            disabled={running || loading || (stats?.counts.failed ?? 0) === 0}
          >
            Reset failed
          </Button>
          <Button size="sm" onClick={runSweepNow} disabled={running || loading}>
            {running
              ? `${runProgress ?? "Sweeping…"} (${String(timerSec).padStart(2, "0")}s)`
              : "Sweep all to treasury"}
          </Button>
        </div>
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
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10 text-sm text-amber-200 px-4 py-3 space-y-2">
          <p>Sweeper is not ready. Fix the issues below in Vercel Production env, then redeploy.</p>
          {stats.diagnostics?.errors.map((err) => (
            <p key={err} className="font-mono text-xs text-amber-100">
              • {err}
            </p>
          ))}
          {stats.diagnostics?.checks.treasuryDerivedAddress && (
            <p className="text-xs font-mono">
              TREASURY_PRIVATE_KEY → {stats.diagnostics.checks.treasuryDerivedAddress}
              <br />
              RECEIVING_WALLET → {stats.receivingWallet}
            </p>
          )}
        </Card>
      )}

      {runResult && (
        <Card className="mb-4 border-accent/30 bg-accent/5 text-sm px-4 py-3 space-y-1">
          <p className="font-medium">
            {aggregatedDrained(runResult)
              ? "All USDT consolidated to treasury"
              : runResult.ok
                ? "Sweep finished"
                : "Sweep finished with errors"}{" "}
            ({runResult.rounds ?? 1} server round
            {(runResult.rounds ?? 1) === 1 ? "" : "s"}, {runResult.durationMs}ms)
          </p>
          <p className="text-xs text-text-muted">
            completed={runResult.completed ?? 0} failed={runResult.failed ?? 0} remaining=
            {runResult.remainingPending ?? runResult.pendingFound ?? 0} gasFunded=
            {runResult.gasFunded} swept={runResult.swept}
            {runResult.batchAddressesFunded != null &&
              runResult.batchAddressesFunded > 0 &&
              ` · BNB→${runResult.batchAddressesFunded} addr`}
          </p>
          {runResult.errors.map((e) => (
            <p key={e} className="text-xs text-red-400 font-mono">
              {e}
            </p>
          ))}
          {runResult.results.map((r) => (
            <p key={r.depositId} className="text-xs font-mono text-text-muted">
              {r.depositId.slice(0, 8)}… → {r.status}
              {r.sweepTxHash ? ` · ${r.sweepTxHash.slice(0, 10)}…` : ""}
            </p>
          ))}
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
                <div className="flex items-center gap-2">
                  {statusBadge(d.sweepStatus, d.sweptAt, d.sweepTxHash)}
                  {d.sweepStatus === "failed" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={running}
                      onClick={async () => {
                        const ok = await resetFailedSweeps(d.id);
                        if (ok) await runSweepNow();
                      }}
                    >
                      Reset & retry
                    </Button>
                  )}
                </div>
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
