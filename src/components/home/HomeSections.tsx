import { Compass, Coins, Lock, Gift, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getPlatformStats } from "@/lib/stats";
import { formatPrice, getDefaultCurrency } from "@/lib/currency";

const features = [
  {
    icon: Compass,
    title: "Explore Collections",
    description:
      "Browse curated digital artifacts with rich metadata, rarity tiers, and live floor prices.",
  },
  {
    icon: Lock,
    title: "Reserve Slots",
    description:
      "Lock in daily reservation windows. Level up to unlock more slots and priority access.",
  },
  {
    icon: Coins,
    title: "Earn on Every Trade",
    description:
      "Collect trading rewards and loyalty points. Transparent fees, on-chain settlement.",
  },
  {
    icon: Gift,
    title: "Airdrop Campaigns",
    description:
      "Participate in seasonal drops and platform token events with verifiable eligibility.",
  },
];

function formatStat(value: number, suffix = "") {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k${suffix}`;
  return `${value}${suffix}`;
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="glow-orb top-0 left-1/4 h-96 w-96 bg-accent/20" />
      <div className="glow-orb top-20 right-1/4 h-72 w-72 bg-gold/10" />
      <div className="absolute inset-0 grid-bg opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-28 lg:pb-24">
        <div className="max-w-3xl">
          <Badge variant="accent" className="mb-6">
            <Zap className="h-3 w-3 mr-1 inline" />
            Web3 NFT Marketplace
          </Badge>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
            Trade artifacts.{" "}
            <span className="text-gradient">Earn rewards.</span>
            <br />
            Own the rift.
          </h1>

          <p className="text-lg text-text-secondary leading-relaxed max-w-xl mb-10">
            A dark, focused marketplace for discovering NFTs, reserving daily slots,
            and earning through transparent on-chain trades — not hype.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button href="/signup" size="lg">
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="/explore" variant="secondary" size="lg">
              Explore marketplace
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export async function StatsBar() {
  let stats = {
    collections: 0,
    nfts: 0,
    activeListings: 0,
    traders: 0,
    totalVolume: 0,
  };

  try {
    stats = await getPlatformStats();
  } catch {
    // DB not initialized yet
  }

  const items = [
    { value: formatStat(stats.collections), label: "Collections" },
    { value: formatStat(stats.nfts), label: "Artifacts" },
    { value: formatStat(stats.activeListings), label: "Active Listings" },
    { value: formatPrice(stats.totalVolume, getDefaultCurrency()), label: "Total Volume" },
  ];

  return (
    <section className="border-y border-border bg-bg-elevated/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map(({ value, label }) => (
            <div key={label} className="text-center lg:text-left">
              <p className="font-display text-2xl sm:text-3xl font-bold text-text-primary">
                {value}
              </p>
              <p className="text-sm text-text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-text-muted mt-6">
          {stats.traders} registered traders
        </p>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Everything in one vault
          </h2>
          <p className="text-text-secondary">
            Same core flows you expect — explore, reserve, trade, earn — built with
            a unique interface and real blockchain settlement.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} shine className="group hover:border-accent/30 transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 mb-5 group-hover:bg-accent/20 transition-colors">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-bg-surface to-bg-elevated p-10 sm:p-14 text-center">
          <div className="glow-orb top-0 left-1/2 -translate-x-1/2 h-48 w-96 bg-accent/15" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Ready to enter the rift?
            </h2>
            <p className="text-text-secondary max-w-md mx-auto mb-8">
              Create your account today. Wallet connect and on-chain payments arrive in later phases.
            </p>
            <Button href="/signup" size="lg" variant="gold">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
