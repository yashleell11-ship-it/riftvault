"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CURRENCY_CODES } from "@/lib/currency";

type Props = {
  nftId: string;
  nftName: string;
  open: boolean;
  onClose: () => void;
};

export function MakeOfferModal({ nftId, nftName, open, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [hours, setHours] = useState("24");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId, amount: parseFloat(amount), currency, expiresInHours: parseInt(hours) }),
    });
    const d = await res.json();
    setMsg({ text: res.ok ? "Offer sent! The owner will be notified." : (d.error ?? "Error"), ok: res.ok });
    if (res.ok) { setAmount(""); setTimeout(onClose, 2000); }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-6">
        <div className="flex items-center gap-2 mb-1">
          <HandCoins className="h-5 w-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Make an offer</h2>
        </div>
        <p className="text-sm text-text-muted mb-5">{nftName}</p>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Offer amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Currency</label>
            <select
              className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary outline-none focus:border-accent/50"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              {CURRENCY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Expires in</label>
            <select
              className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary outline-none focus:border-accent/50"
              value={hours}
              onChange={e => setHours(e.target.value)}
            >
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
              <option value="168">7 days</option>
            </select>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.text}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Sending…" : "Send offer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
