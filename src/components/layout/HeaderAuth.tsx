"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Hexagon, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { WithdrawWalletButton } from "@/components/wallet/WithdrawWalletButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { levelLabel } from "@/lib/levels";
import { NotificationBell } from "@/components/layout/NotificationBell";
import type { AuthUser } from "@/lib/types";

export function HeaderAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <div className="hidden md:block w-24 h-9 bg-bg-hover rounded-lg animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="hidden md:flex items-center gap-3">
        <Button href="/login" variant="ghost" size="sm">
          Log in
        </Button>
        <Button href="/signup" size="sm">
          Get started
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-3 relative">
      <NotificationBell />
      <WithdrawWalletButton
        initialAddress={user.withdrawWalletAddress}
        onSaved={(address) =>
          setUser((current) =>
            current ? { ...current, withdrawWalletAddress: address } : current
          )
        }
      />
      <Badge variant="gold">{levelLabel(user.level)}</Badge>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm hover:border-accent/30 transition-colors"
      >
        <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
          <Hexagon className="h-3.5 w-3.5 text-accent" />
        </div>
        <span className="max-w-[100px] truncate">{user.displayName}</span>
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-border bg-bg-surface shadow-xl py-1">
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg-hover"
            >
              <LayoutDashboard className="h-4 w-4 text-text-muted" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg-hover"
            >
              Profile
            </Link>
            {user.role === "admin" && (
              <Link href="/admin" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg-hover text-accent">
                <Shield className="h-4 w-4" />Admin panel
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-bg-hover"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function MobileAuthButtons({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  if (user) {
    return (
      <div className="space-y-2 pt-3 border-t border-border mt-3">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium">{user.displayName}</span>
          <Badge variant="gold">{levelLabel(user.level)}</Badge>
        </div>
        <div className="px-4">
          <WithdrawWalletButton
            initialAddress={user.withdrawWalletAddress}
            size="md"
          />
        </div>
        <Button href="/dashboard" variant="secondary" size="sm" className="w-full" onClick={onNavigate}>
          Dashboard
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-danger" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 pt-3 border-t border-border mt-3">
      <Button href="/login" variant="secondary" size="sm" className="flex-1" onClick={onNavigate}>
        Log in
      </Button>
      <Button href="/signup" size="sm" className="flex-1" onClick={onNavigate}>
        Get started
      </Button>
    </div>
  );
}
