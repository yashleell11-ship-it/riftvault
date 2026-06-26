"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, Copy, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { currencyOptions, getDefaultCurrency, normalizeCurrency, type CurrencyCode } from "@/lib/currency";
import { CHAINS } from "@/lib/chains";

type DepositAddress = {
  id: string;
  chainKey: string;
  asset: string;
  address: string;
};

type CryptoDeposit = {
  id: string;
  chainKey: string;
  asset: string;
  amount: number;
  txHash: string | null;
  status: string;
  createdAt: string;
};

type DepositInfo = {
  demoDepositsEnabled: boolean;
  uniqueAddressesEnabled: boolean;
  uniqueAddressesComingSoon: boolean;
  addresses: DepositAddress[];
  recentDeposits: CryptoDeposit[];
};

type Props = {
  currency: CurrencyCode;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function DepositPanel({ currency, onSuccess, onError }: Props) {
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [reportAmount, setReportAmount] = useState("");
  const [reportCurrency, setReportCurrency] = useState<CurrencyCode>(getDefaultCurrency());
  const [reportChain, setReportChain] = useState(CHAINS[0]?.key ?? "sepolia");
  const [reportTxHash, setReportTxHash] = useState("");
  const [submitting, setSubmitting] = useState<"demo" | "report" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wallet/deposit-info");
    if (res.ok) setInfo(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDemoDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    setSubmitting("demo");
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency }),
    });
    const data = await res.json();
    setSubmitting(null);

    if (res.ok) {
      setDepositAmount("");
      onSuccess("Demo deposit credited to your ledger.");
      load();
    } else {
      onError(data.error ?? "Deposit failed");
    }
  }

  async function handleReportDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(reportAmount);
    if (!amount || amount <= 0) return;

    setSubmitting("report");
    const res = await fetch("/api/wallet/deposit/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: reportCurrency,
        chainKey: reportChain,
        txHash: reportTxHash.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(null);

    if (res.ok) {
      setReportAmount("");
      setReportTxHash("");
      onSuccess(data.message ?? "Deposit reported for review.");
      load();
    } else {
      onError(data.error ?? "Could not report deposit");
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  const demoMode = info?.demoDepositsEnabled ?? false;
  const hasAddresses = (info?.addresses.length ?? 0) > 0;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <ArrowDownLeft className="h-4 w-4 text-accent" />
        <h2 className="font-display font-semibold">Deposit crypto</h2>
      </div>

      {info?.uniqueAddressesComingSoon && !hasAddresses && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2.5 text-xs text-text-secondary">
          <div className="flex items-start gap-2">
            <QrCode className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <p>
              <strong className="text-gold">Unique deposit addresses</strong> for every user are
              coming in the next update. Until then, send crypto then report your transfer below.
            </p>
          </div>
        </div>
      )}

      {hasAddresses && (
        <div className="mb-4 space-y-3">
          {info!.addresses.map((row) => {
            const chain = CHAINS.find((c) => c.key === row.chainKey);
            return (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-text-muted">
                    {chain?.shortName ?? row.chainKey} · {row.asset}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => copyAddress(row.address)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copied === row.address ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs font-mono text-accent break-all">{row.address}</p>
              </div>
            );
          })}
        </div>
      )}

      {demoMode ? (
        <>
          <p className="text-xs text-text-muted mb-3">
            Dev mode — instant ledger credit for testing purchases and withdrawals.
          </p>
          <form onSubmit={handleDemoDeposit} className="space-y-3">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
              required
            />
            <Button type="submit" className="w-full" disabled={submitting === "demo"}>
              {submitting === "demo" ? "Processing..." : "Credit deposit (demo)"}
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="text-xs text-text-muted mb-3">
            After sending crypto on-chain, submit the details. An admin confirms and credits your
            balance.
          </p>
          <form onSubmit={handleReportDeposit} className="space-y-3">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Amount sent"
              value={reportAmount}
              onChange={(e) => setReportAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
              required
            />
            <select
              value={reportCurrency}
              onChange={(e) => setReportCurrency(normalizeCurrency(e.target.value))}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
            >
              {currencyOptions().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol}
                </option>
              ))}
            </select>
            <select
              value={reportChain}
              onChange={(e) => setReportChain(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
            >
              {CHAINS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tx hash (optional, 0x…)"
              value={reportTxHash}
              onChange={(e) => setReportTxHash(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm font-mono"
            />
            <Button type="submit" className="w-full" disabled={submitting === "report"}>
              {submitting === "report" ? "Submitting..." : "Report deposit"}
            </Button>
          </form>
        </>
      )}

      {(info?.recentDeposits.length ?? 0) > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wide">Recent deposits</p>
          {info!.recentDeposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span>
                {d.amount} {d.asset}
              </span>
              <Badge
                variant={
                  d.status === "confirmed" ? "accent" : d.status === "pending" ? "gold" : "default"
                }
              >
                {d.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
