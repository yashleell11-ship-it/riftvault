"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KYC_TIERS } from "@/lib/kyc";

type KycRow = {
  id: string;
  userId: string;
  tier: number;
  status: string;
  legalName: string | null;
  country: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: { id: string; email: string; displayName: string; level?: number };
};

export function AdminKycPage() {
  const [pending, setPending] = useState<KycRow[]>([]);
  const [recent, setRecent] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/kyc");
    if (res.ok) {
      const d = await res.json();
      setPending(d.pending ?? []);
      setRecent(d.recent ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(userId: string, status: "approved" | "rejected", tier?: number) {
    setActing(userId);
    const res = await fetch(`/api/admin/kyc/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, tier }),
    });
    const d = await res.json();
    setMsg(res.ok ? `KYC ${status}.` : d.error);
    await load();
    setActing(null);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">Admin</Badge>
        <h1 className="font-display text-2xl font-bold">KYC verification</h1>
        <p className="text-sm text-text-secondary mt-1">Review identity submissions for withdrawal tiers.</p>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          {msg}
        </div>
      )}

      <Card className="mb-8">
        <h2 className="font-medium mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-gold" /> Pending ({pending.length})
        </h2>
        {loading ? (
          <div className="h-32 animate-pulse bg-bg-hover rounded-xl" />
        ) : pending.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">No pending submissions.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-bg-hover border border-border px-4 py-4"
              >
                <div>
                  <p className="font-medium">
                    {row.legalName ?? "—"}{" "}
                    <span className="text-text-muted text-xs font-normal">({row.user.email})</span>
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {row.user.displayName} · {row.country ?? "—"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Submitted {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={acting === row.userId}
                    onClick={() => review(row.userId, "approved", 1)}
                  >
                    <CheckCircle className="h-4 w-4 text-accent" /> Tier 1
                  </Button>
                  <Button
                    size="sm"
                    disabled={acting === row.userId}
                    onClick={() => review(row.userId, "approved", 2)}
                  >
                    <CheckCircle className="h-4 w-4 text-accent" /> Tier 2
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={acting === row.userId}
                    onClick={() => review(row.userId, "rejected")}
                  >
                    <XCircle className="h-4 w-4 text-danger" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium mb-4">Recent decisions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No reviewed submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((row) => (
              <div
                key={row.id}
                className="flex justify-between items-center text-sm py-2 border-b border-border/50 last:border-0"
              >
                <span>
                  {row.user.displayName} — {row.legalName}
                </span>
                <Badge variant={row.status === "approved" ? "accent" : "danger"}>
                  {row.status === "approved"
                    ? KYC_TIERS[row.tier as keyof typeof KYC_TIERS]?.label ?? `Tier ${row.tier}`
                    : "Rejected"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
