import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Developers" };

const endpoints = [
  { method: "GET", path: "/api/v1/nfts", auth: true, desc: "List active NFT listings.", params: ["limit (max 100)", "offset", "collection (slug)", "rarity"] },
  { method: "GET", path: "/api/v1/collections", auth: true, desc: "List all collections with floor price and NFT count.", params: [] },
];

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <Badge variant="accent" className="mb-3">Public API</Badge>
        <h1 className="font-display text-4xl font-bold mb-3">RiftVault API Docs</h1>
        <p className="text-text-secondary max-w-2xl">Read-only public API to query marketplace data. Generate an API key in your <a href="/dashboard/developer" className="text-accent hover:underline">developer dashboard</a>.</p>
      </div>

      <Card className="mb-6">
        <h2 className="font-display text-lg font-semibold mb-3">Authentication</h2>
        <p className="text-sm text-text-secondary mb-3">All requests must include your API key in the <code className="bg-bg-hover px-1.5 py-0.5 rounded text-accent">X-API-Key</code> header.</p>
        <pre className="bg-bg-hover rounded-xl p-4 text-sm font-mono text-text-primary overflow-x-auto">
{`curl https://riftvault.io/api/v1/nfts \\
  -H "X-API-Key: rv_your_key_here"`}
        </pre>
        <p className="text-xs text-text-muted mt-3">Rate limit: 60 requests per minute per key. Exceeding returns HTTP 429.</p>
      </Card>

      <div className="space-y-4 mb-8">
        {endpoints.map(ep => (
          <Card key={ep.path}>
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="accent">{ep.method}</Badge>
              <code className="font-mono text-sm">{ep.path}</code>
            </div>
            <p className="text-sm text-text-secondary mb-3">{ep.desc}</p>
            {ep.params.length > 0 && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Query params</p>
                <div className="flex flex-wrap gap-2">
                  {ep.params.map(p => <code key={p} className="text-xs bg-bg-hover px-2 py-1 rounded text-text-secondary">{p}</code>)}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold mb-3">Webhooks</h2>
        <p className="text-sm text-text-secondary mb-3">Subscribe to marketplace events via HTTP POST. Payloads are signed with HMAC-SHA256 — verify using the <code className="bg-bg-hover px-1.5 rounded">X-RiftVault-Signature</code> header and your webhook secret.</p>
        <div className="space-y-2 text-sm">
          {["order.completed", "offer.received", "withdrawal.approved", "airdrop.claimable"].map(ev => (
            <div key={ev} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <code className="text-text-secondary">{ev}</code>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-4">Configure webhooks in your <a href="/dashboard/developer" className="text-accent hover:underline">developer settings</a>.</p>
      </Card>
    </div>
  );
}
