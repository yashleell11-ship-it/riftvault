"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Notif = { id: string; type: string; title: string; body: string; read: boolean; link: string | null; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications?limit=10");
    if (res.ok) { const d = await res.json(); setNotifs(d.notifications); setUnread(d.unread); }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-4 rounded-full bg-accent text-[10px] font-bold text-bg-base flex items-center justify-center px-0.5">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-2xl border border-border bg-bg-surface shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim">
                <Check className="h-3 w-3" />Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">No notifications yet.</p>
            ) : (
              notifs.map(n => (
                <div key={n.id} className={cn("flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-bg-hover transition-colors", !n.read && "bg-accent/5")}>
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", n.read ? "bg-transparent" : "bg-accent")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-text-muted mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {n.link && (
                    <Link href={n.link} onClick={() => setOpen(false)} className="shrink-0 text-text-muted hover:text-accent">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
