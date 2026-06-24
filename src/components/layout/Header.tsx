"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Hexagon } from "lucide-react";
import { useState } from "react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { HeaderAuth, MobileAuthButtons } from "./HeaderAuth";
import { ChainSelector } from "./ChainSelector";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 group-hover:bg-accent/20 transition-colors">
            <Hexagon className="h-5 w-5 text-accent" strokeWidth={1.5} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            {SITE_NAME}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <ChainSelector />
          <HeaderAuth />
        </div>

        <button
          type="button"
          className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-4 py-3 rounded-xl text-sm font-medium",
                pathname === href
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              {label}
            </Link>
          ))}
          <MobileAuthButtons onNavigate={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  );
}
