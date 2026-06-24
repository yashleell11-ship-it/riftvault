"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled ?? false));
  }, []);

  async function startSetup() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Setup failed");
      return;
    }
    setSetup({ secret: data.secret, uri: data.uri });
    setMessage("Add the secret to Google Authenticator, then enter a code below.");
  }

  async function enable2fa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Enable failed");
      return;
    }
    setEnabled(true);
    setSetup(null);
    setCode("");
    setMessage("Two-factor authentication enabled.");
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Disable failed");
      return;
    }
    setEnabled(false);
    setCode("");
    setMessage("Two-factor authentication disabled.");
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="h-4 w-4 text-accent" />
        <h2 className="font-medium">Two-factor authentication</h2>
        {enabled && <Badge variant="accent">On</Badge>}
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Optional TOTP via an authenticator app. Required at login when enabled.
      </p>

      {!enabled && !setup && (
        <Button size="sm" onClick={startSetup} disabled={loading}>
          Set up 2FA
        </Button>
      )}

      {setup && !enabled && (
        <form onSubmit={enable2fa} className="space-y-3">
          <p className="text-xs font-mono break-all bg-bg-base border border-border rounded-lg p-3">
            {setup.secret}
          </p>
          <p className="text-xs text-text-muted break-all">{setup.uri}</p>
          <Input
            label="Authenticator code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
          <Button type="submit" size="sm" disabled={loading}>
            Confirm & enable
          </Button>
        </form>
      )}

      {enabled && (
        <form onSubmit={disable2fa} className="space-y-3">
          <Input
            label="Code to disable"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
          <Button type="submit" size="sm" variant="secondary" disabled={loading}>
            Disable 2FA
          </Button>
        </form>
      )}

      {message && <p className="text-sm text-accent mt-3">{message}</p>}
    </Card>
  );
}
