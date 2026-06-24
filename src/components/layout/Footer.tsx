import Link from "next/link";
import { Hexagon } from "lucide-react";
import { NAV_LINKS, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-elevated mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                <Hexagon className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <span className="font-display text-base font-bold">{SITE_NAME}</span>
            </div>
            <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
              {SITE_TAGLINE}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">Platform</h4>
            <ul className="space-y-2">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">Account</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-text-secondary hover:text-accent transition-colors">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-text-secondary hover:text-accent transition-colors">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row justify-between gap-4">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p className="text-xs text-text-muted">Phases 1–33 complete</p>
        </div>
      </div>
    </footer>
  );
}
