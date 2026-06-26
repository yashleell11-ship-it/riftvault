"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowDownLeft, Copy, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  currencyOptions,
  getDefaultCurrency,
  normalizeCurrency,
  type CurrencyCode,
} from "@/lib/currency";
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
  confirmations?: number;
  createdAt: string;
};

type DepositInfo = {
  demoDepositsEnabled: boolean;
  uniqueAddressesEnabled: boolean;
  uniqueAddressesComingSoon: boolean;
  addresses: DepositAddress[];
  addressProvisionError?: string | null;
  recentDeposits: CryptoDeposit[];
};

type Props = {
  currency: CurrencyCode;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

function DepositAddressCard({
  row,
  copied,
  onCopy,
}: {
  row: DepositAddress;
  copied: string | null;
  onCopy: (address: string) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const chain = CHAINS.find((c) => c.key === row.chainKey);

  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(row.address, {
        margin: 2,
        width: 160,
        color: { dark: "#00e5c3", light: "#0a0e1a" },
      }).then(setQr);
    });
  }, [row.address]);

  return (
    <div className="rounded-xl border border-accent/20 bg-bg-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="accent">
          {chain?.shortName ?? row.chainKey} · {row.asset}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onCopy(row.address)}
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied === row.address ? "Copied" : "Copy"}
        </Button>
      </div>

      {qr && (
        <div className="flex justify-center">
          <Image src={qr} alt="Deposit QR" width={160} height={160} unoptimized />
        </div>
      )}

      <p className="text-xs font-mono text-accent break-all text-center">{row.address}</p>
      <p className="text-[11px] text-text-muted text-center">
        Send only <strong className="text-text-secondary">{row.asset}</strong> on{" "}
        <strong className="text-text-secondary">{chain?.name ?? row.chainKey}</strong> (BEP20).
        Deposits credit automatically after confirmations.
      </p>
    </div>
  );
}

export function DepositPanel({ currency, onSuccess, onError }: Props) {
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [reportAmount, setReportAmount] = useState("");
  const [reportCurrency, setReportCurrency] = useState<CurrencyCode>(getDefaultCurrency());
  const [reportChain, setReportChain] = useState(CHAINS[0]?.key ?? "bsc");
  const [reportTxHash, setReportTxHash] = useState("");
  const [submitting, setSubmitting] = useState<"demo" | "report" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (withScan = false) => {
    const url = withScan ? "/api/wallet/deposit-info?scan=1" : "/api/wallet/deposit-info";
    try {
      const res = await fetch(url);
      if (res.ok) {
        setInfo(await res.json());
        setFetchError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setFetchError(
          typeof data.error === "string"
            ? data.error
            : `Could not load deposit info (${res.status})`
        );
      }
    } catch {
      setFetchError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const statusPoll = setInterval(() => load(false), 10_000);
    const scanPoll = setInterval(() => load(true), 60_000);
    return () => {
      clearInterval(statusPoll);
      clearInterval(scanPoll);
    };
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
      load(true);
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
      load(true);
    } else {
      onError(data.error ?? "Could not report deposit");
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading && !info) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  const demoMode = info?.demoDepositsEnabled ?? false;
  const uniqueMode = info?.uniqueAddressesEnabled ?? false;
  const hasAddresses = (info?.addresses.length ?? 0) > 0;
  const provisionError = info?.addressProvisionError ?? null;
  const showReportForm = Boolean(info) && !demoMode && !uniqueMode;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <ArrowDownLeft className="h-4 w-4 text-accent" />
        <h2 className="font-display font-semibold">Deposit crypto</h2>
      </div>

      {fetchError && (
        <p className="text-xs text-danger mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
          {fetchError}
        </p>
      )}

      {uniqueMode && hasAddresses && (
        <div className="mb-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-text-secondary mb-2">
            <QrCode className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p>
              Your <strong className="text-accent">personal deposit address</strong> — send USDT
              here and your balance updates automatically.
            </p>
          </div>
          {info!.addresses.map((row) => (
            <DepositAddressCard
              key={row.id}
              row={row}
              copied={copied}
              onCopy={copyAddress}
            />
          ))}
        </div>
      )}

      {uniqueMode && !hasAddresses && !provisionError && (
        <div className="mb-4 flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Generating your personal deposit address…
        </div>
      )}

      {uniqueMode && provisionError && (
        <p className="text-xs text-danger mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
          {provisionError}
        </p>
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
        showReportForm && (
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
        )
      )}

      {(info?.recentDeposits.length ?? 0) > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wide">Recent deposits</p>
          {info!.recentDeposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs gap-2">
              <span>
                {d.amount} {d.asset}
                {d.status === "detecting" && d.confirmations != null && (
                  <span className="text-text-muted"> · {d.confirmations} conf</span>
                )}
              </span>
              <Badge
                variant={
                  d.status === "confirmed"
                    ? "accent"
                    : d.status === "pending" || d.status === "detecting" || d.status === "confirming"
                      ? "gold"
                      : "default"
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
