"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2, Webhook, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type ApiKeyRow = { id: string; keyPrefix: string; name: string; lastUsed: string | null; createdAt: string };
type WebhookRow = { id: string; url: string; events: string[]; active: boolean; createdAt: string };

export function DeveloperPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [keyName, setKeyName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(["order.completed"]);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const EVENTS = ["order.completed", "offer.received", "withdrawal.approved", "airdrop.claimable"];

  const load = useCallback(async () => {
    const [kr, wr] = await Promise.all([fetch("/api/developer/keys"), fetch("/api/developer/webhooks")]);
    if (kr.ok) { const d = await kr.json(); setKeys(d.keys); }
    if (wr.ok) { const d = await wr.json(); setWebhooks(d.webhooks); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/developer/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: keyName }) });
    const d = await res.json();
    if (res.ok) { setNewKey({ key: d.key, name: d.name }); setKeyName(""); await load(); }
    else setMsg(d.error ?? "Error");
  }

  async function deleteKey(id: string) {
    await fetch(`/api/developer/keys/${id}`, { method: "DELETE" });
    await load();
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/developer/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: whUrl, events: whEvents }) });
    const d = await res.json();
    if (res.ok) { setMsg(`Webhook created. Secret: ${d.secret} — store this securely, it won't be shown again.`); setWhUrl(""); await load(); }
    else setMsg(d.error ?? "Error");
  }

  async function testWebhooks() {
    const res = await fetch("/api/webhooks/test", { method: "POST" });
    const d = await res.json();
    setMsg(res.ok ? `Test sent to ${d.results?.length ?? 0} webhook(s).` : (d.error ?? "Error"));
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Badge variant="accent" className="mb-3">Developer</Badge>
        <h1 className="font-display text-3xl font-bold mb-2">API Keys &amp; Webhooks</h1>
        <p className="text-text-muted text-sm">Access the RiftVault public API and receive real-time event webhooks.</p>
      </div>

      {msg && <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent break-all">{msg} <button className="ml-2 text-text-muted hover:text-text-primary" onClick={() => setMsg(null)}>✕</button></div>}

      {newKey && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-4">
          <p className="text-sm font-semibold text-gold mb-2">New API key — copy now, it won&apos;t be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-bg-base rounded-lg px-3 py-2 text-sm font-mono text-text-primary break-all">{newKey.key}</code>
            <Button variant="secondary" size="sm" onClick={() => copyKey(newKey.key)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <button className="text-xs text-text-muted mt-2 hover:text-text-primary" onClick={() => setNewKey(null)}>Dismiss</button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="flex items-center gap-2 mb-4"><Key className="h-4 w-4 text-accent" /><h2 className="font-display text-lg font-semibold">API Keys</h2></div>
          <form onSubmit={createKey} className="flex gap-2 mb-4">
            <Input placeholder="Key name (e.g. My App)" value={keyName} onChange={e => setKeyName(e.target.value)} required className="flex-1" />
            <Button type="submit" variant="secondary" size="sm"><Plus className="h-4 w-4" /></Button>
          </form>
          {keys.length === 0 ? <p className="text-sm text-text-muted text-center py-4">No API keys yet.</p> : (
            <div className="space-y-2">
              {keys.map(k => (
                <div key={k.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg-hover border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-text-muted font-mono">{k.keyPrefix}…</p>
                    {k.lastUsed && <p className="text-xs text-text-muted">Last used {new Date(k.lastUsed).toLocaleDateString()}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteKey(k.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border">Pass as <code className="bg-bg-hover px-1 rounded">X-API-Key</code> header. 60 req/min. Rate limit resets per key.</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4"><Webhook className="h-4 w-4 text-accent" /><h2 className="font-display text-lg font-semibold">Webhooks</h2></div>
          <form onSubmit={createWebhook} className="space-y-3 mb-4">
            <Input label="Endpoint URL" type="url" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://example.com/webhook" required />
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Events</p>
              <div className="flex flex-wrap gap-2">
                {EVENTS.map(ev => (
                  <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={whEvents.includes(ev)} onChange={e => setWhEvents(w => e.target.checked ? [...w, ev] : w.filter(x => x !== ev))} className="accent-accent" />
                    <span className="text-xs text-text-secondary">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="secondary" size="sm" className="w-full"><Plus className="h-4 w-4" />Add webhook</Button>
          </form>
          {webhooks.length > 0 && (
            <div className="space-y-2">
              {webhooks.map(w => (
                <div key={w.id} className="rounded-xl bg-bg-hover border border-border px-3 py-2.5">
                  <p className="text-xs font-mono text-text-primary truncate">{w.url}</p>
                  <p className="text-xs text-text-muted mt-0.5">{w.events.join(", ")}</p>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={testWebhooks} className="w-full mt-2">Send test event</Button>
            </div>
          )}
          <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border">Payloads are HMAC-SHA256 signed via <code className="bg-bg-hover px-1 rounded">X-RiftVault-Signature</code>.</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold mb-3">Quick Reference</h2>
        <div className="space-y-3 text-sm font-mono">
          {[
            ["GET", "/api/v1/nfts", "List active listings"],
            ["GET", "/api/v1/collections", "List all collections"],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-3">
              <Badge variant={method === "GET" ? "accent" : "gold"} className="shrink-0">{method}</Badge>
              <span className="text-text-primary">{path}</span>
              <span className="text-text-muted text-xs hidden sm:block">— {desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-4"><a href="/developers" className="text-accent hover:underline">View full API docs →</a></p>
      </Card>
    </div>
  );
}
