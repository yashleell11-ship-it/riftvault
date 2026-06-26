"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, Users, Wallet, ImageIcon, Gift, BarChart2, Hexagon, ShieldCheck, ScrollText, Building2, ArrowDownLeft, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", icon: Shield, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowDownLeft },
  { href: "/admin/sweeps", label: "Sweeper", icon: Landmark },
  { href: "/admin/kyc", label: "KYC", icon: ShieldCheck },
  { href: "/admin/nfts", label: "Upload NFTs", icon: ImageIcon },
  { href: "/admin/airdrops", label: "Airdrops", icon: Gift },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== "admin") router.replace("/dashboard");
      else setChecked(true);
    });
  }, [router]);

  if (!checked) return null;

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-elevated flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Hexagon className="h-4 w-4 text-accent" />
        <span className="font-display text-sm font-bold text-accent">Admin</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && href !== "/admin";
          const isExactAdmin = href === "/admin" && pathname === "/admin";
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                (active || isExactAdmin) ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              )}
            >
              <Icon className="h-4 w-4" />{label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors px-3 py-2">
          ← Back to dashboard
        </Link>
      </div>
    </aside>
  );
}
