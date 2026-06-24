"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type NftRow = { tokenId: string; name: string; imageUrl: string; rarity: string; description: string };

const BLANK_NFT: NftRow = { tokenId: "", name: "", imageUrl: "", rarity: "common", description: "" };

export function CreatorStudio() {
  const [step, setStep] = useState<1 | 2>(1);
  const [col, setCol] = useState({ name: "", slug: "", description: "", imageUrl: "", royaltyBps: 250 });
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [nfts, setNfts] = useState<NftRow[]>([{ ...BLANK_NFT }]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function addRow() { setNfts(n => [...n, { ...BLANK_NFT }]); }
  function removeRow(i: number) { setNfts(n => n.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, k: keyof NftRow, v: string) { setNfts(n => n.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    const res = await fetch("/api/creator/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...col, royaltyBps: Number(col.royaltyBps) }) });
    const d = await res.json();
    if (res.ok) { setCollectionId(d.collection.id); setStep(2); }
    else setMsg({ text: d.error ?? "Error", ok: false });
    setLoading(false);
  }

  async function mintNfts(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    const res = await fetch("/api/creator/nfts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectionId, nfts }) });
    const d = await res.json();
    setMsg({ text: res.ok ? `${d.created} NFTs minted successfully!` : (d.error ?? "Error"), ok: res.ok });
    if (res.ok) setNfts([{ ...BLANK_NFT }]);
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <Badge variant="accent" className="mb-3">Creator Studio</Badge>
        <h1 className="font-display text-3xl font-bold mb-2">Create Collection</h1>
        <div className="flex items-center gap-3 mt-4">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-accent text-bg-base" : "bg-bg-hover text-text-muted"}`}>{s}</div>
              <span className={`text-sm ${step === s ? "text-text-primary" : "text-text-muted"}`}>{s === 1 ? "Collection details" : "Upload NFTs"}</span>
              {s < 2 && <ChevronRight className="h-4 w-4 text-text-muted" />}
            </div>
          ))}
        </div>
      </div>

      {msg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-accent/30 bg-accent/10 text-accent" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>{msg.text}</div>}

      {step === 1 && (
        <Card>
          <h2 className="font-display text-lg font-semibold mb-4">Collection Details</h2>
          <form onSubmit={createCollection} className="space-y-4">
            <Input label="Collection Name" value={col.name} onChange={e => setCol(c => ({ ...c, name: e.target.value }))} required />
            <Input label="Slug (URL)" value={col.slug} onChange={e => setCol(c => ({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="my-collection" required />
            <Input label="Cover Image URL" type="url" value={col.imageUrl} onChange={e => setCol(c => ({ ...c, imageUrl: e.target.value }))} placeholder="https://..." />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary">Description</label>
              <textarea className="rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary outline-none focus:border-accent/50 resize-none" rows={3} value={col.description} onChange={e => setCol(c => ({ ...c, description: e.target.value }))} />
            </div>
            <div>
              <Input label="Royalty %" type="number" min={0} max={10} step={0.1} value={col.royaltyBps / 100} onChange={e => setCol(c => ({ ...c, royaltyBps: Math.round(Number(e.target.value) * 100) }))} />
              <p className="text-xs text-text-muted mt-1">Displayed for informational purposes — on-chain royalties require smart contract deployment.</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create collection"} <ChevronRight className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Upload NFTs</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" />Back</Button>
          </div>
          <form onSubmit={mintNfts} className="space-y-4">
            {nfts.map((nft, i) => (
              <div key={i} className="rounded-xl border border-border bg-bg-hover p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">NFT #{i + 1}</span>
                  {nfts.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Token ID" value={nft.tokenId} onChange={e => updateRow(i, "tokenId", e.target.value)} required />
                  <Input label="Name" value={nft.name} onChange={e => updateRow(i, "name", e.target.value)} required />
                </div>
                <Input label="Image URL" type="url" value={nft.imageUrl} onChange={e => updateRow(i, "imageUrl", e.target.value)} required placeholder="https://..." />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-secondary">Rarity</label>
                  <select className="h-10 rounded-xl border border-border bg-bg-elevated px-3 text-sm outline-none focus:border-accent/50" value={nft.rarity} onChange={e => updateRow(i, "rarity", e.target.value)}>
                    {["common", "uncommon", "rare", "epic", "legendary"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addRow} className="w-full"><Plus className="h-4 w-4" />Add another NFT</Button>
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Minting…" : `Mint ${nfts.length} NFT${nfts.length > 1 ? "s" : ""}`}</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
