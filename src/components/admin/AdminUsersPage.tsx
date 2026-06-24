"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, UserX, UserCheck, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { levelLabel } from "@/lib/levels";

type User = { id: string; email: string; displayName: string; level: number; role: string; frozen: boolean; emailVerified: string | null; createdAt: string };

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleFreeze(user: User) {
    setActing(user.id);
    await fetch(`/api/admin/users?id=${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ frozen: !user.frozen }) });
    await load(q);
    setActing(null);
  }

  async function toggleAdmin(user: User) {
    setActing(user.id);
    await fetch(`/api/admin/users?id=${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: user.role === "admin" ? "user" : "admin" }) });
    await load(q);
    setActing(null);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Badge variant="accent" className="mb-2">Admin</Badge>
          <h1 className="font-display text-2xl font-bold">Users</h1>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-xl px-3 h-10 w-64">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted" placeholder="Search email or name…" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load(q)} />
        </div>
      </div>
      <Card>
        {loading ? <div className="h-48 animate-pulse bg-bg-hover rounded-xl" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-muted border-b border-border">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Level</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{u.displayName}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </td>
                    <td className="py-3"><Badge variant="gold">{levelLabel(u.level)}</Badge></td>
                    <td className="py-3"><Badge variant={u.role === "admin" ? "accent" : "default"}>{u.role}</Badge></td>
                    <td className="py-3"><Badge variant={u.frozen ? "danger" : "default"}>{u.frozen ? "Frozen" : "Active"}</Badge></td>
                    <td className="py-3 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => toggleFreeze(u)} disabled={acting === u.id}>
                          {u.frozen ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                          {u.frozen ? "Unfreeze" : "Freeze"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleAdmin(u)} disabled={acting === u.id}>
                          <Shield className="h-4 w-4" />
                          {u.role === "admin" ? "Demote" : "Admin"}
                        </Button>
                      </div>
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
