"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  History,
  Wallet,
} from "lucide-react";
import { WithdrawWalletButton } from "@/components/wallet/WithdrawWalletButton";
import { truncateAddress } from "@/lib/crypto-address";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  currencyOptions,
  formatPrice,
  getDefaultCurrency,
  normalizeCurrency,
  type CurrencyCode,
} from "@/lib/currency";

type BalanceResponse = {
  balances: Record<string, number>;
  primaryBalance: number;
  defaultCurrency: string;
};

type WalletTx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  status: string;
  description: string | null;
  createdAt: string;
};

function txLabel(type: string) {
  const map: Record<string, string> = {
    deposit: "Deposit",
    withdraw: "Withdrawal",
    purchase: "Purchase",
    sale: "Sale",
    reward: "Reward",
  };
  return map[type] ?? type;
}

function statusVariant(status: string): "accent" | "gold" | "default" {
  if (status === "completed") return "accent";
  if (status === "pending") return "gold";
  return "default";
}

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>(getDefaultCurrency());
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWalletAddress, setWithdrawWalletAddress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"deposit" | "withdraw" | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [balRes, txRes, meRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/wallet/transactions?limit=30"),
      fetch("/api/auth/me"),
    ]);

    if (!meRes.ok) {
      router.push("/login?redirect=/dashboard/wallet");
      return;
    }

    const me = await meRes.json();
    setWithdrawWalletAddress(me.user?.withdrawWalletAddress ?? null);

    if (balRes.ok) setBalance(await balRes.json());
    if (txRes.ok) {
      const data = await txRes.json();
      setTransactions(data.items ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    setSubmitting("deposit");
    setMessage(null);
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency }),
    });
    const data = await res.json();
    setSubmitting(null);

    if (res.ok) {
      setDepositAmount("");
      setMessage({ type: "ok", text: "Crypto deposit credited to your ledger." });
      load();
    } else {
      setMessage({ type: "err", text: data.error ?? "Deposit failed" });
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;

    setSubmitting("withdraw");
    setMessage(null);
    const res = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency }),
    });
    const data = await res.json();
    setSubmitting(null);

    if (res.ok) {
      setWithdrawAmount("");
      setMessage({
        type: "ok",
        text: "Crypto withdrawal request submitted — pending admin approval.",
      });
      load();
    } else {
      setMessage({ type: "err", text: data.error ?? "Withdrawal failed" });
    }
  }

  const selectedBalance = balance?.balances[normalizeCurrency(currency)] ?? 0;

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="h-8 w-40 bg-bg-hover rounded animate-pulse mb-8" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="h-48 animate-pulse bg-bg-hover" />
          <Card className="h-48 animate-pulse bg-bg-hover" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <Badge variant="gold" className="mb-3">
          Crypto-native
        </Badge>
        <h1 className="font-display text-2xl font-bold mb-2">Wallet</h1>
        <p className="text-text-secondary text-sm max-w-xl">
          Manage your on-platform crypto balances (ETH, USDT, BNB, BTC). Fund purchases from
          your ledger, pay on-chain via MetaMask on Explore, or bridge assets across chains.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card className="px-4 py-3">
          <Wallet className="h-4 w-4 text-accent mb-2" />
          <p className="font-medium text-sm mb-1">Receiving wallet</p>
          {withdrawWalletAddress ? (
            <p className="text-xs font-mono text-accent break-all">
              {truncateAddress(withdrawWalletAddress, 10, 8)}
            </p>
          ) : (
            <p className="text-xs text-text-muted mb-2">Not set — required for withdrawals</p>
          )}
          <div className="mt-2">
            <WithdrawWalletButton
              initialAddress={withdrawWalletAddress}
              onSaved={setWithdrawWalletAddress}
              size="sm"
            />
          </div>
        </Card>
        <Link
          href="/dashboard/bridge"
          className="rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm hover:border-accent/40 transition-colors"
        >
          <ArrowUpRight className="h-4 w-4 text-gold mb-2" />
          <p className="font-medium">Bridge</p>
          <p className="text-xs text-text-muted mt-1">Move assets between chains</p>
        </Link>
        <Link
          href="/explore"
          className="rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm hover:border-accent/40 transition-colors"
        >
          <Gift className="h-4 w-4 text-accent mb-2" />
          <p className="font-medium">Explore NFTs</p>
          <p className="text-xs text-text-muted mt-1">Pay with ledger or on-chain ETH</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card shine className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-4 w-4 text-accent" />
            <p className="text-xs text-text-muted uppercase tracking-wide">Balance</p>
          </div>
          <p className="font-display text-3xl font-bold text-gold mb-4">
            {formatPrice(selectedBalance, currency)}
          </p>
          <select
            value={currency}
            onChange={(e) => setCurrency(normalizeCurrency(e.target.value))}
            className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm"
          >
            {currencyOptions().map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.symbol})
              </option>
            ))}
          </select>
          {balance && Object.keys(balance.balances).length > 1 && (
            <div className="mt-4 pt-4 border-t border-border space-y-1">
              {Object.entries(balance.balances).map(([code, amt]) => (
                <div key={code} className="flex justify-between text-xs text-text-muted">
                  <span>{code}</span>
                  <span>{formatPrice(amt, code)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownLeft className="h-4 w-4 text-accent" />
            <h2 className="font-display font-semibold">Deposit crypto</h2>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Demo ledger credit — in production, deposits confirm from on-chain transfers.
          </p>
          <form onSubmit={handleDeposit} className="space-y-3">
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
            <Button type="submit" className="w-full" disabled={submitting === "deposit"}>
              {submitting === "deposit" ? "Processing..." : "Credit deposit"}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="h-4 w-4 text-gold" />
            <h2 className="font-display font-semibold">Withdraw crypto</h2>
          </div>
          {withdrawWalletAddress ? (
            <p className="text-xs text-text-muted mb-3">
              Funds will be sent to{" "}
              <span className="font-mono text-accent break-all">{withdrawWalletAddress}</span>
            </p>
          ) : (
            <p className="text-xs text-danger mb-3">
              Set your receiving wallet in the header before withdrawing.
            </p>
          )}
          <form onSubmit={handleWithdraw} className="space-y-3">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
              required
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={submitting === "withdraw" || !withdrawWalletAddress}
            >
              {submitting === "withdraw" ? "Submitting..." : "Request withdrawal"}
            </Button>
          </form>
          <p className="text-xs text-text-muted mt-3">
            On-chain withdrawals require identity verification for higher limits.{" "}
            <Link href="/dashboard/verification" className="text-accent hover:text-accent-dim">
              Verify identity →
            </Link>
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-6">
          <History className="h-4 w-4 text-text-muted" />
          <h2 className="font-display text-lg font-semibold">Transaction history</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="h-10 w-10 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary text-sm">
              No transactions yet. Credit a crypto deposit or buy an NFT on Explore.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Details</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3">{txLabel(tx.type)}</td>
                    <td
                      className={`py-3 font-medium ${
                        tx.amount >= 0 ? "text-accent" : "text-danger"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatPrice(tx.amount, tx.currency)}
                    </td>
                    <td className="py-3">
                      <Badge variant={statusVariant(tx.status)}>{tx.status}</Badge>
                    </td>
                    <td className="py-3 text-text-muted hidden sm:table-cell truncate max-w-[200px]">
                      {tx.description ?? "—"}
                    </td>
                    <td className="py-3 text-text-muted hidden md:table-cell">
                      {new Date(tx.createdAt).toLocaleString()}
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
