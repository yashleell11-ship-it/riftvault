"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";
import { CURRENCIES, getDefaultCurrency, type CurrencyCode } from "@/lib/currency";

export default function SettingsPage() {
  const [currency, setCurrency] = useState<CurrencyCode>("USDT");

  useEffect(() => {
    fetch("/api/currency")
      .then((r) => r.json())
      .then((d) => setCurrency(d.defaultCurrency ?? getDefaultCurrency()));
  }, []);

  const info = CURRENCIES[currency];

  return (
    <div className="p-6 lg:p-10 max-w-xl">
      <h1 className="font-display text-2xl font-bold mb-2">Settings</h1>
      <p className="text-text-secondary text-sm mb-8">
        Account preferences and security.
      </p>

      <Card className="mb-4">
        <h2 className="font-medium mb-1">Platform currency</h2>
        <p className="text-sm text-text-secondary mb-3">
          Default currency for new listings, stats, and rewards. Change in{" "}
          <code className="text-xs bg-bg-elevated px-1.5 py-0.5 rounded">.env</code>:
        </p>
        <Badge variant="gold" className="mb-2">
          {info.symbol} — {info.name}
        </Badge>
        <p className="text-xs text-text-muted font-mono">
          NEXT_PUBLIC_DEFAULT_CURRENCY={currency}
        </p>
        <p className="text-xs text-text-muted mt-2">
          Supported: ETH, USDT, BNB, BTC. Restart dev server after changing.
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="font-medium mb-1">Password</h2>
        <p className="text-sm text-text-secondary mb-3">
          Change your password via the forgot-password flow.
        </p>
        <a href="/forgot-password" className="text-sm text-accent hover:text-accent-dim">
          Reset password →
        </a>
      </Card>

      <Card className="mb-4">
        <h2 className="font-medium mb-1">Notifications</h2>
        <p className="text-sm text-text-secondary">
          Email notification preferences arrive in a later phase.
        </p>
      </Card>

      <TwoFactorSettings />

      <Card>
        <h2 className="font-medium mb-1">Wallet connect</h2>
        <p className="text-sm text-text-secondary mb-3">
          Link MetaMask or WalletConnect on your profile for on-chain ETH purchases.
        </p>
        <a href="/dashboard/profile" className="text-sm text-accent hover:text-accent-dim">
          Open profile →
        </a>
      </Card>
    </div>
  );
}
