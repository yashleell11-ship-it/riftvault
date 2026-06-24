"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Hexagon,
  LayoutDashboard,
  ImageIcon,
  ShoppingBag,
  User,
  Settings,
  LogOut,
  Wallet,
  Users,
  ArrowLeftRight,
  ShieldCheck,
  BarChart2,
  Code2,
  Palette,
} from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { levelLabel } from "@/lib/levels";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/types";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/nfts", label: "My NFTs", icon: ImageIcon },
  { href: "/dashboard/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/bridge", label: "Bridge", icon: ArrowLeftRight },
  { href: "/dashboard/verification", label: "Verification", icon: ShieldCheck },
  { href: "/dashboard/create", label: "Create", icon: Palette },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/developer", label: "Developer", icon: Code2 },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg-elevated flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="p-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
            <Hexagon className="h-4 w-4 text-accent" />
          </div>
          <span className="font-display font-bold text-sm">{SITE_NAME}</span>
        </Link>
        {user && (
          <div>
            <p className="font-medium text-sm truncate">{user.displayName}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
            <Badge variant="gold" className="mt-2">
              {levelLabel(user.level)}
            </Badge>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary hover:text-danger hover:bg-bg-hover transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
