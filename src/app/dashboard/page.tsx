import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { levelLabel } from "@/lib/levels";
import { Compass, Lock, Coins } from "lucide-react";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold mb-1">
          Welcome back, {user.displayName}
        </h1>
        <p className="text-text-secondary text-sm">
          Your vault dashboard — manage NFTs, orders, and profile.
        </p>
      </div>

      {!user.emailVerified && <EmailVerificationBanner email={user.email} />}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Level</p>
          <Badge variant="gold" className="text-base px-4 py-1.5">
            {levelLabel(user.level)}
          </Badge>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Email status</p>
          <p className="font-medium">
            {user.emailVerified ? (
              <span className="text-accent">Verified</span>
            ) : (
              <span className="text-gold">Pending verification</span>
            )}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Referral code</p>
          <p className="font-mono text-sm truncate">{user.referralCode}</p>
        </Card>
      </div>

      <h2 className="font-display text-lg font-semibold mb-4">Quick actions</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="hover:border-accent/30 transition-colors">
          <Compass className="h-5 w-5 text-accent mb-3" />
          <h3 className="font-medium mb-1">Explore</h3>
          <p className="text-xs text-text-secondary mb-4">Browse the marketplace</p>
          <Button href="/explore" variant="secondary" size="sm">
            Go to explore
          </Button>
        </Card>
        <Card className="hover:border-accent/30 transition-colors">
          <Lock className="h-5 w-5 text-accent mb-3" />
          <h3 className="font-medium mb-1">Reserve</h3>
          <p className="text-xs text-text-secondary mb-4">Daily reservation slots</p>
          <Button href="/reserve" variant="secondary" size="sm">
            View reserve
          </Button>
        </Card>
        <Card className="hover:border-accent/30 transition-colors">
          <Coins className="h-5 w-5 text-accent mb-3" />
          <h3 className="font-medium mb-1">Earn</h3>
          <p className="text-xs text-text-secondary mb-4">Trading & referral rewards</p>
          <Button href="/earn" variant="secondary" size="sm">
            View earn
          </Button>
        </Card>
      </div>
    </div>
  );
}
