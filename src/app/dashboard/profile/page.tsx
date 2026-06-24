"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { WithdrawWalletForm } from "@/components/wallet/WithdrawWalletForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { levelLabel } from "@/lib/levels";
import type { AuthUser } from "@/lib/types";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setDisplayName(d.user.displayName);
        }
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });

    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setMessage("Profile updated.");
    } else {
      setMessage(data.error ?? "Update failed.");
    }
    setSaving(false);
  }

  if (!user) {
    return (
      <div className="p-10">
        <div className="h-8 w-48 bg-bg-hover rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-xl">
      <h1 className="font-display text-2xl font-bold mb-2">Profile</h1>
      <p className="text-text-secondary text-sm mb-8">
        Your account details and the crypto address where withdrawals are sent.
      </p>

      <Card className="mb-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-muted">Level</span>
          <Badge variant="gold">{levelLabel(user.level)}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-muted">Email</span>
          <span className="text-sm">{user.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-muted">Referral code</span>
          <span className="font-mono text-sm">{user.referralCode}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-muted">Member since</span>
          <span className="text-sm">
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : "—"}
          </span>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="font-medium mb-1">Receiving wallet</h2>
        <p className="text-sm text-text-secondary mb-4">
          When you withdraw crypto from your balance, funds are sent to this address.
          It is unique to your account — use your own personal wallet, not an exchange
          deposit address unless you are sure it supports the asset.
        </p>
        <WithdrawWalletForm
          initialAddress={user.withdrawWalletAddress ?? null}
          onSaved={(address) =>
            setUser((current) =>
              current ? { ...current, withdrawWalletAddress: address } : current
            )
          }
        />
      </Card>

      <form onSubmit={handleSave} className="space-y-5">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        {message && (
          <p className={`text-sm ${message.includes("updated") ? "text-accent" : "text-danger"}`}>
            {message}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
