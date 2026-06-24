"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Collection = { id: string; name: string };

export function AdminNftsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [form, setForm] = useState({ name: "", description: "", imageUrl: "", rarity: "common", collectionId: "", tokenId: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pinataEnabled, setPinataEnabled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/nfts/collections").then(r => r.ok ? r.json() : { collections: [] }).then(d => setCollections(d.collections ?? []));
    fetch("/api/admin/pinata-status").then(r => r.ok ? r.json() : { enabled: false }).then(d => setPinataEnabled(d.enabled ?? false)).catch(() => {});
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);

    let res: Response;

    if (imageFile) {
      const fd = new FormData();
      fd.append("name", form.name);
      if (form.description) fd.append("description", form.description);
      fd.append("rarity", form.rarity);
      fd.append("collectionId", form.collectionId);
      fd.append("tokenId", form.tokenId);
      fd.append("imageUrl", form.imageUrl);
      fd.append("image", imageFile);
      res = await fetch("/api/admin/nfts", { method: "POST", body: fd });
    } else {
      res = await fetch("/api/admin/nfts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
    }

    const d = await res.json();
    setMsg({ text: res.ok ? `NFT "${form.name}" created.${pinataEnabled && imageFile ? " Image uploaded to IPFS." : ""}` : (d.error ?? "Error"), ok: res.ok });
    if (res.ok) {
      setForm({ name: "", description: "", imageUrl: "", rarity: "common", collectionId: "", tokenId: "" });
      setImageFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">Admin</Badge>
        <h1 className="font-display text-2xl font-bold">Upload NFT</h1>
        <p className="text-sm text-text-muted mt-1">
          Add a new NFT to an existing collection.
          {pinataEnabled
            ? " Image files will be pinned to IPFS via Pinata."
            : " Set PINATA_JWT to enable IPFS uploads."}
        </p>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-accent/30 bg-accent/10 text-accent" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Input label="NFT Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Token ID" value={form.tokenId} onChange={e => setForm(f => ({ ...f, tokenId: e.target.value }))} required placeholder="e.g. 42" />

          {/* Image upload */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Image</label>
            <div
              className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg-hover p-6 cursor-pointer hover:border-accent/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {preview
                ? <img src={preview} alt="preview" className="h-32 w-32 rounded-xl object-cover" />
                : <><Upload className="h-8 w-8 text-text-muted" /><p className="text-sm text-text-muted">Click to upload image</p></>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>
            <p className="text-xs text-text-muted">Or paste a URL below:</p>
            <Input placeholder="https://... or leave blank if uploading file" type="url" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Collection</label>
            <select className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary outline-none focus:border-accent/50" value={form.collectionId} onChange={e => setForm(f => ({ ...f, collectionId: e.target.value }))} required>
              <option value="">Select a collection…</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Rarity</label>
            <select className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary outline-none focus:border-accent/50" value={form.rarity} onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}>
              {["common", "uncommon", "rare", "epic", "legendary"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Description (optional)</label>
            <textarea className="rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <Button type="submit" disabled={loading || (!imageFile && !form.imageUrl)} className="w-full">
            <ImageIcon className="h-4 w-4" /><Plus className="h-4 w-4" />
            {loading ? "Creating…" : "Create NFT"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
