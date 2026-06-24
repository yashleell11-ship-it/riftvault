import { formatPrice } from "@/lib/currency";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  level: number;
  emailVerified: string | null;
  referralCode?: string;
  walletAddress?: string | null;
  withdrawWalletAddress?: string | null;
  role?: string;
  frozen?: boolean;
  isCreator?: boolean;
  createdAt?: string;
};

export type NftItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  rarity: string;
  status: string;
  tokenId: string;
  chainTokenId: string | null;
  chainListingId: string | null;
  collection: { name: string; slug: string };
  listing: { id?: string; price: number; currency: string; status: string } | null;
};

/** @deprecated Use formatPrice from @/lib/currency */
export function formatEth(value: number, currency?: string | null) {
  return formatPrice(value, currency);
}

export function rarityColor(rarity: string) {
  const map: Record<string, string> = {
    common: "text-text-secondary",
    uncommon: "text-accent",
    rare: "text-blue-400",
    epic: "text-purple-400",
    legendary: "text-gold",
  };
  return map[rarity] ?? "text-text-secondary";
}
