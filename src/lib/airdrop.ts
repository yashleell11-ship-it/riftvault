import type { AirdropCampaign, User } from "@prisma/client";

export type AirdropEligibility = {
  eligible: boolean;
  reason?: string;
};

export function checkAirdropEligibility(
  campaign: AirdropCampaign,
  user: Pick<User, "level" | "emailVerified">,
  claimCount: number,
  userHasClaimed: boolean
): AirdropEligibility {
  const now = new Date();

  if (!campaign.active) {
    return { eligible: false, reason: "Campaign is not active" };
  }

  if (campaign.startsAt > now) {
    return { eligible: false, reason: "Campaign has not started yet" };
  }

  if (campaign.endsAt && campaign.endsAt < now) {
    return { eligible: false, reason: "Campaign has ended" };
  }

  if (userHasClaimed) {
    return { eligible: false, reason: "Already claimed" };
  }

  if (campaign.maxClaims != null && claimCount >= campaign.maxClaims) {
    return { eligible: false, reason: "Campaign claim limit reached" };
  }

  if (campaign.requiresEmailVerified && !user.emailVerified) {
    return { eligible: false, reason: "Email verification required" };
  }

  if (user.level < campaign.minLevel) {
    return {
      eligible: false,
      reason: `Requires level ${campaign.minLevel} or higher`,
    };
  }

  return { eligible: true };
}
