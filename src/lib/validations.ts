import { z } from "zod";
import { isValidCryptoAddress } from "@/lib/crypto-address";
import { CURRENCY_CODES } from "@/lib/currency";

const currencySchema = z.enum(CURRENCY_CODES);

export const signupSchema = z.object({
  displayName: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export const listForSaleSchema = z.object({
  nftId: z.string().min(1),
  price: z.number().positive().max(1000000),
  currency: currencySchema.optional(),
});

export const buyNftSchema = z.object({
  nftId: z.string().min(1),
});

export const reserveNftSchema = z.object({
  nftId: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  walletAddress: z.string().max(100).optional().nullable(),
  preferredChain: z.string().max(30).optional(),
});

export const walletDepositSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  currency: currencySchema.optional(),
});

export const walletWithdrawSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  currency: currencySchema.optional(),
});

export const airdropClaimSchema = z.object({
  campaignId: z.string().min(1),
});

export const governanceProposalSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  daysOpen: z.number().int().min(1).max(30).optional(),
});

export const governanceVoteSchema = z.object({
  choice: z.enum(["for", "against"]),
});

export const bridgeIntentSchema = z.object({
  fromChain: z.string().min(1),
  toChain: z.string().min(1),
  token: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
});

export const bridgeIntentUpdateSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const kycSubmitSchema = z.object({
  legalName: z.string().min(2).max(100),
  country: z.string().min(2).max(80),
});

export const withdrawWalletSchema = z.object({
  address: z
    .string()
    .min(26)
    .max(100)
    .refine((value) => isValidCryptoAddress(value), {
      message: "Enter a valid EVM (0x…) or Bitcoin address",
    }),
});

