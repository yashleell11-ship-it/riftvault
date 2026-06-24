"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type Row = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  actor: { displayName: string; email: string };
};

export function AdminAuditPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/audit?limit=100");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2">Admin</Badge>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-accent" />
          Audit log
        </h1>
        <p className="text-sm text-text-secondary mt-1">Admin actions across users, KYC, withdrawals, and tenants.</p>
      </div>

      <Card>
        {loading ? (
          <div className="h-48 animate-pulse bg-bg-hover rounded-xl" />
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Actor</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Target</th>
                  <th className="pb-3 font-medium hidden lg:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 text-text-muted whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <p className="font-medium">{row.actor.displayName}</p>
                      <p className="text-xs text-text-muted">{row.actor.email}</p>
                    </td>
                    <td className="py-3">
                      <Badge>{row.action}</Badge>
                    </td>
                    <td className="py-3 text-text-muted hidden md:table-cell font-mono text-xs">
                      {row.targetType ? `${row.targetType}:${row.targetId?.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="py-3 text-text-muted hidden lg:table-cell max-w-xs truncate">
                      {row.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
