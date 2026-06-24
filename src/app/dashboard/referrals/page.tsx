"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { levelLabel } from "@/lib/levels";
import { formatPrice, getDefaultCurrency } from "@/lib/currency";

type TeamMember = {
  id: string;
  displayName: string;
  email: string;
  level: number;
  createdAt: string;
  earningsFromMember: number;
};

type TeamData = {
  direct: (TeamMember & { level: 1 })[];
  indirect: (TeamMember & { level: 2 })[];
  totals: {
    directCount: number;
    indirectCount: number;
    teamCount: number;
    referralEarnings: number;
  };
};

export default function ReferralsPage() {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const currency = getDefaultCurrency();

  useEffect(() => {
    fetch("/api/referrals/team")
      .then((r) => (r.ok ? r.json() : null))
      .then(setTeam)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="h-8 w-48 bg-bg-hover rounded animate-pulse mb-8" />
        <Card className="h-64 animate-pulse bg-bg-hover" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-text-secondary">Unable to load referral team.</p>
      </div>
    );
  }

  function MemberTable({
    title,
    members,
    tier,
  }: {
    title: string;
    members: TeamMember[];
    tier: 1 | 2;
  }) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <Badge variant={tier === 1 ? "accent" : "gold"}>Level {tier}</Badge>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No level-{tier} referrals yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-3 font-medium">Member</th>
                  <th className="pb-3 font-medium">Level</th>
                  <th className="pb-3 font-medium">Your earnings</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{m.displayName}</p>
                      <p className="text-xs text-text-muted">{m.email}</p>
                    </td>
                    <td className="py-3">
                      <Badge variant="default">{levelLabel(m.level)}</Badge>
                    </td>
                    <td className="py-3 text-gold font-medium">
                      {formatPrice(m.earningsFromMember, currency)}
                    </td>
                    <td className="py-3 text-text-muted hidden sm:table-cell">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <Badge variant="gold" className="mb-3">
          Referrals
        </Badge>
        <h1 className="font-display text-2xl font-bold mb-2">Your team</h1>
        <p className="text-text-secondary text-sm max-w-xl">
          Two-level referral cap. Commissions are paid on platform fees only (L1: 50%, L2: 25% of
          the 2% platform fee).
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card shine>
          <Users className="h-4 w-4 text-accent mb-2" />
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Team size</p>
          <p className="font-display text-2xl font-bold">{team.totals.teamCount}</p>
          <p className="text-xs text-text-muted mt-1">
            {team.totals.directCount} direct · {team.totals.indirectCount} indirect
          </p>
        </Card>
        <Card>
          <UserPlus className="h-4 w-4 text-gold mb-2" />
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Direct (L1)</p>
          <p className="font-display text-2xl font-bold">{team.totals.directCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Referral earnings</p>
          <p className="font-display text-2xl font-bold text-gold">
            {formatPrice(team.totals.referralEarnings, currency)}
          </p>
        </Card>
      </div>

      <div className="space-y-6 mb-8">
        <MemberTable title="Direct referrals" members={team.direct} tier={1} />
        <MemberTable title="Indirect referrals" members={team.indirect} tier={2} />
      </div>

      <Button href="/earn" variant="secondary">
        Back to earn dashboard
      </Button>
    </div>
  );
}
