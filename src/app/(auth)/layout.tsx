import Link from "next/link";
import { Hexagon } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-bg-elevated border-r border-border">
        <div className="glow-orb top-1/4 left-1/3 h-80 w-80 bg-accent/20" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
              <Hexagon className="h-5 w-5 text-accent" />
            </div>
            <span className="font-display text-xl font-bold">{SITE_NAME}</span>
          </div>
          <h2 className="font-display text-3xl font-bold leading-tight mb-4">
            Your vault awaits.
          </h2>
          <p className="text-text-secondary max-w-sm leading-relaxed">
            Sign in to reserve artifacts, track earnings, and connect your wallet
            when blockchain payments go live.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden flex items-center justify-center pt-8 pb-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
              <Hexagon className="h-4 w-4 text-accent" />
            </div>
            <span className="font-display font-bold">{SITE_NAME}</span>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
