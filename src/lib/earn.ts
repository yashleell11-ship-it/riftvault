export const TRADING_REWARD_RATE = 0.025;
export const PLATFORM_FEE_RATE = 0.02;
export const REFERRAL_L1_SHARE = 0.5;
export const REFERRAL_L2_SHARE = 0.25;
export const MAX_REFERRAL_LEVELS = 2;

export function calcTradingReward(price: number) {
  return Math.round(price * TRADING_REWARD_RATE * 10000) / 10000;
}

export function calcPlatformFee(price: number) {
  return Math.round(price * PLATFORM_FEE_RATE * 10000) / 10000;
}

/** Commission on platform fees only — L1: 50% of fee, L2: 25% of fee */
export function calcReferralCommission(price: number, level: 1 | 2) {
  const fee = calcPlatformFee(price);
  const share = level === 1 ? REFERRAL_L1_SHARE : REFERRAL_L2_SHARE;
  return Math.round(fee * share * 10000) / 10000;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function buildReferralLink(referralCode: string) {
  return `${getAppUrl()}/signup?ref=${referralCode}`;
}
