"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type BridgeRoute = {
  id: string;
  fromChain: string;
  toChain: string;
  token: string;
  minAmount: number;
  etaMinutes: number;
  note: string;
};

type BridgeIntent = {
  id: string;
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  status: string;
  txHash: string | null;
  createdAt: string;
};

export default function BridgePage() {
  const [routes, setRoutes] = useState<BridgeRoute[]>([]);
  const [intents, setIntents] = useState<BridgeIntent[]>([]);
  const [fromChain, setFromChain] = useState("ethereum-sepolia");
  const [toChain, setToChain] = useState("bsc-testnet");
  const [token, setToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/bridge");
    if (res.ok) {
      const d = await res.json();
      setRoutes(d.routes ?? []);
      setIntents(d.intents ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitIntent(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    setSubmitting(true);
    setMessage("");
    const res = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromChain, toChain, token, amount: num }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setMessage(data.message ?? "Intent recorded.");
    setAmount("");
    load();
  }

  async function markComplete(id: string) {
    const txHash = txInputs[id]?.trim();
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setMessage("Enter a valid 66-character transaction hash.");
      return;
    }

    const res = await fetch(`/api/bridge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, status: "completed" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Update failed");
      return;
    }
    setMessage("Bridge intent marked complete.");
    load();
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <Badge variant="gold" className="mb-3">
        Cross-chain
      </Badge>
      <h1 className="font-display text-2xl font-bold mb-2">Bridge</h1>
      <p className="text-text-secondary text-sm mb-8">
        Record a bridge intent and complete the transfer via an external bridge. RiftVault does not custody bridged funds.
      </p>

      <Card className="mb-6">
        <form onSubmit={submitIntent} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted mb-1 block">From chain</label>
            <select
              className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm"
              value={fromChain}
              onChange={(e) => setFromChain(e.target.value)}
            >
              <option value="ethereum-sepolia">Ethereum Sepolia</option>
              <option value="bsc-testnet">BSC Testnet</option>
              <option value="polygon-amoy">Polygon Amoy</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">To chain</label>
            <select
              className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm"
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
            >
              <option value="bsc-testnet">BSC Testnet</option>
              <option value="ethereum-sepolia">Ethereum Sepolia</option>
              <option value="polygon-amoy">Polygon Amoy</option>
            </select>
          </div>
          <Input label="Token" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} />
          <Input
            label="Amount"
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Recording…" : "Record bridge intent"}
          </Button>
        </form>
        {message && <p className="text-sm text-accent mt-4">{message}</p>}
      </Card>

      {intents.length > 0 && (
        <>
          <h2 className="font-medium mb-3">Your intents</h2>
          <div className="space-y-3 mb-8">
            {intents.map((intent) => (
              <Card key={intent.id} className="!p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium">
                    {intent.amount} {intent.token}: {intent.fromChain} → {intent.toChain}
                  </span>
                  <Badge variant={intent.status === "completed" ? "accent" : "gold"}>
                    {intent.status}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted mb-3">
                  {new Date(intent.createdAt).toLocaleString()}
                </p>
                {intent.txHash ? (
                  <p className="text-xs font-mono text-accent break-all flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {intent.txHash}
                  </p>
                ) : intent.status === "pending" ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <input
                      placeholder="0x… tx hash"
                      value={txInputs[intent.id] ?? ""}
                      onChange={(e) =>
                        setTxInputs((prev) => ({ ...prev, [intent.id]: e.target.value }))
                      }
                      className="flex-1 min-w-[200px] rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-mono"
                    />
                    <Button size="sm" onClick={() => markComplete(intent.id)}>
                      Mark complete
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="font-medium mb-3">Supported routes</h2>
      <div className="space-y-3">
        {routes.map((r) => (
          <Card key={r.id} className="!p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowLeftRight className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">
                {r.fromChain} → {r.toChain} ({r.token})
              </span>
            </div>
            <p className="text-xs text-text-secondary flex items-center gap-1 mb-1">
              <Clock className="h-3 w-3" /> ~{r.etaMinutes} min · min {r.minAmount} {r.token}
            </p>
            <p className="text-xs text-text-muted">{r.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
