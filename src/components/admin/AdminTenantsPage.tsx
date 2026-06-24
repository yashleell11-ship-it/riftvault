"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  accentHex: string | null;
  active: boolean;
};

export function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [accentHex, setAccentHex] = useState("#00e5c3");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tenants");
    if (res.ok) {
      const d = await res.json();
      setTenants(d.tenants ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, tagline: tagline || undefined, accentHex }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Create failed");
      return;
    }
    setSlug("");
    setName("");
    setTagline("");
    setMsg(`Tenant "${data.tenant.slug}" created. Set NEXT_PUBLIC_TENANT_SLUG=${data.tenant.slug} to activate.`);
    load();
  }

  async function toggleActive(t: Tenant) {
    await fetch(`/api/admin/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">Admin</Badge>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-accent" />
          White-label tenants
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage branding per deployment. Point <code className="text-xs">NEXT_PUBLIC_TENANT_SLUG</code> at a slug.
        </p>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          {msg}
        </div>
      )}

      <Card className="mb-8">
        <h2 className="font-medium mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> New tenant
        </h2>
        <form onSubmit={createTenant} className="grid sm:grid-cols-2 gap-3">
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="acme-market" required />
          <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="sm:col-span-2" />
          <Input label="Accent hex" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit">Create tenant</Button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <div className="h-32 animate-pulse bg-bg-hover rounded-xl" />
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-hover px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {t.name}{" "}
                    <span className="text-text-muted font-mono text-xs">({t.slug})</span>
                  </p>
                  <p className="text-xs text-text-secondary">{t.tagline ?? "—"}</p>
                  {t.accentHex && (
                    <span
                      className="inline-block mt-2 h-4 w-4 rounded border border-border"
                      style={{ backgroundColor: t.accentHex }}
                      title={t.accentHex}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.active ? "accent" : "default"}>{t.active ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(t)}>
                    {t.active ? "Deactivate" : "Activate"}
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
