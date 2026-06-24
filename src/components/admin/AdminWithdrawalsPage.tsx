"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Tx = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    withdrawWalletAddress: string | null;
  };
};

export function AdminWithdrawalsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/withdrawals");
    if (res.ok) { const d = await res.json(); setTxs(d.withdrawals); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(id: string, act: "approve" | "reject") {
    setActing(id);
    const res = await fetch(`/api/admin/withdrawals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: act }) });
    const d = await res.json();
    setMsg(d.success ? `Withdrawal ${act}d.` : d.error);
    await load();
    setActing(null);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">Admin</Badge>
        <h1 className="font-display text-2xl font-bold">Pending Withdrawals</h1>
      </div>
      {msg && <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{msg}</div>}
      <Card>
        {loading ? <div className="h-48 animate-pulse bg-bg-hover rounded-xl" /> : txs.length === 0 ? (
          <div className="text-center py-12 text-text-muted">No pending withdrawals.</div>
        ) : (
          <div className="space-y-4">
            {txs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between gap-4 rounded-xl bg-bg-hover border border-border px-4 py-4">
                <div>
                  <p className="font-medium">{tx.user.displayName} <span className="text-text-muted text-xs">({tx.user.email})</span></p>
                  <p className="text-sm text-text-secondary mt-0.5">{Math.abs(tx.amount)} {tx.currency} — {tx.description ?? "Withdrawal"}</p>
                  {tx.user.withdrawWalletAddress && (
                    <p className="text-xs font-mono text-accent mt-1 break-all">
                      Send to: {tx.user.withdrawWalletAddress}
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => action(tx.id, "approve")} disabled={acting === tx.id}>
                    <CheckCircle className="h-4 w-4 text-accent" /> Approve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => action(tx.id, "reject")} disabled={acting === tx.id}>
                    <XCircle className="h-4 w-4 text-danger" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
