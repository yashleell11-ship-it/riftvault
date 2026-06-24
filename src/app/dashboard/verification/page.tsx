"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type KycResponse = {
  profile: {
    legalName: string | null;
    country: string | null;
    status: string;
    tier: number;
  } | null;
  tier: number;
  limits: { label: string; perTx: number; daily: number };
};

export default function VerificationPage() {
  const [data, setData] = useState<KycResponse | null>(null);
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/kyc");
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setLegalName(json.profile?.legalName ?? "");
      setCountry(json.profile?.country ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalName, country }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "Submit failed");
      return;
    }
    setMessage(json.message ?? "Submitted.");
    load();
  }

  if (loading) {
    return <div className="p-6 text-text-muted text-sm">Loading…</div>;
  }

  const status = data?.profile?.status ?? "none";
  const tierLabel = data?.limits?.label ?? "Unverified";

  return (
    <div className="p-6 lg:p-10 max-w-xl">
      <Badge variant="gold" className="mb-3">
        KYC tiers
      </Badge>
      <h1 className="font-display text-2xl font-bold mb-2">Identity verification</h1>
      <p className="text-text-secondary text-sm mb-8">
        Higher tiers unlock larger crypto withdrawal limits. Demo flow — admin approves in production.
      </p>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          {status === "approved" ? (
            <ShieldCheck className="h-8 w-8 text-accent" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-gold" />
          )}
          <div>
            <p className="font-medium">{tierLabel}</p>
            <p className="text-xs text-text-muted capitalize">Status: {status}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-bg-base border border-border p-3">
            <p className="text-text-muted text-xs">Per crypto withdrawal</p>
            <p className="font-medium">{data?.limits.perTx.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-bg-base border border-border p-3">
            <p className="text-text-muted text-xs">Daily limit</p>
            <p className="font-medium">{data?.limits.daily.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {status !== "approved" && (
        <Card>
          <h2 className="font-medium mb-4">Submit verification</h2>
          <form onSubmit={submit} className="space-y-3">
            <Input
              label="Legal name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              required
            />
            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
            />
            <Button type="submit" disabled={status === "pending"}>
              {status === "pending" ? "Pending review" : "Submit for review"}
            </Button>
          </form>
          {message && <p className="text-sm text-accent mt-3">{message}</p>}
        </Card>
      )}
    </div>
  );
}
