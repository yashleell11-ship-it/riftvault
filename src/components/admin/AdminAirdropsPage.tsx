"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Campaign = { id: string; slug: string; name: string; tokenAmount: number; currency: string; active: boolean; startsAt: string; endsAt: string | null; _count: { claims: number } };

const blank = { slug: "", name: "", description: "", tokenAmount: 25, currency: "USDT", minLevel: 1, requiresEmailVerified: true, maxClaims: "", startsAt: new Date().toISOString().slice(0, 16), endsAt: "" };

export function AdminAirdropsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/airdrops");
    if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, tokenAmount: Number(form.tokenAmount), minLevel: Number(form.minLevel), maxClaims: form.maxClaims ? Number(form.maxClaims) : undefined, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined };
    const res = await fetch("/api/admin/airdrops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    setMsg(res.ok ? "Campaign created." : (d.error ?? "Error"));
    if (res.ok) { setForm(blank); await load(); }
  }

  async function toggle(c: Campaign) {
    await fetch(`/api/admin/airdrops/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    await load();
  }

  async function del(id: string) {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`/api/admin/airdrops/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6"><Badge variant="accent" className="mb-2">Admin</Badge><h1 className="font-display text-2xl font-bold">Airdrop Campaigns</h1></div>
      {msg && <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{msg}</div>}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display text-lg font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={create} className="space-y-3">
            <Input label="Slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="my-campaign" required />
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount" type="number" value={form.tokenAmount} onChange={e => setForm(f => ({ ...f, tokenAmount: Number(e.target.value) }))} required />
              <Input label="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Min Level" type="number" min={1} max={5} value={form.minLevel} onChange={e => setForm(f => ({ ...f, minLevel: Number(e.target.value) }))} />
              <Input label="Max Claims" type="number" value={form.maxClaims} onChange={e => setForm(f => ({ ...f, maxClaims: e.target.value }))} placeholder="Unlimited" />
            </div>
            <Input label="Starts At" type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} required />
            <Input label="Ends At" type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
            <Button type="submit" size="sm" className="w-full"><Plus className="h-4 w-4" />Create</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold mb-4">All Campaigns</h2>
          {loading ? <div className="h-48 animate-pulse bg-bg-hover rounded-xl" /> : (
            <div className="space-y-3">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-hover border border-border px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-text-muted">{c.tokenAmount} {c.currency} · {c._count.claims} claims</p>
                    <Badge variant={c.active ? "accent" : "default"} className="mt-1 text-xs">{c.active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                      {c.active ? <ToggleRight className="h-4 w-4 text-accent" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
