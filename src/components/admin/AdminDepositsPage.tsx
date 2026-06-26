"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CHAINS } from "@/lib/chains";

type Deposit = {
  id: string;
  chainKey: string;
  asset: string;
  amount: number;
  txHash: string | null;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

export function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/deposits");
    if (res.ok) {
      const d = await res.json();
      setDeposits(d.deposits);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function action(id: string, act: "confirm" | "reject") {
    setActing(id);
    const res = await fetch(`/api/admin/deposits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const d = await res.json();
    setMsg(d.success ? `Deposit ${act === "confirm" ? "confirmed" : "rejected"}.` : d.error);
    await load();
    setActing(null);
  }

  function chainLabel(key: string) {
    return CHAINS.find((c) => c.key === key)?.shortName ?? key;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">
          Admin
        </Badge>
        <h1 className="font-display text-2xl font-bold">Deposit queue</h1>
        <p className="text-sm text-text-muted mt-1">
          Confirm user-reported on-chain deposits before unique addresses go live.
        </p>
      </div>

      {msg && (
        <div className="mb-4 text-sm text-accent border border-accent/30 bg-accent/10 rounded-xl px-4 py-2">
          {msg}
        </div>
      )}

      {loading ? (
        <Card className="h-40 animate-pulse bg-bg-hover" />
      ) : deposits.length === 0 ? (
        <Card className="text-center py-12 text-text-muted text-sm">No pending deposits.</Card>
      ) : (
        <div className="space-y-3">
          {deposits.map((d) => (
            <Card key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{d.user.displayName}</p>
                <p className="text-xs text-text-muted truncate">{d.user.email}</p>
                <p className="text-sm mt-2">
                  <span className="text-gold font-semibold">
                    {d.amount} {d.asset}
                  </span>
                  <span className="text-text-muted"> · {chainLabel(d.chainKey)}</span>
                </p>
                {d.txHash && (
                  <p className="text-xs font-mono text-text-muted mt-1 truncate">{d.txHash}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  {new Date(d.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={acting === d.id}
                  onClick={() => action(d.id, "confirm")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={acting === d.id}
                  onClick={() => action(d.id, "reject")}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
