"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  initialAddress?: string | null;
  onSaved?: (address: string) => void;
};

export function WithdrawWalletForm({ initialAddress, onSaved }: Props) {
  const [input, setInput] = useState(initialAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setInput(initialAddress ?? "");
  }, [initialAddress]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/user/withdraw-wallet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: input.trim() }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save address");
      return;
    }

    const address = data.address as string;
    setInput(address);
    setSuccess("Saved — withdrawals will go to this address.");
    onSaved?.(address);
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className="text-xs text-text-muted block mb-1">
          Your receiving address
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x… or bc1…"
          className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm font-mono"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : initialAddress ? "Update address" : "Save address"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-accent">{success}</p>}
    </form>
  );
}
