import { formatUnits, parseUnits } from "viem";
import { USDT_DECIMALS } from "@/payments/blockchain/usdt-bep20";

/** Build a unique payable amount: list price + random 4–6 digit fractional suffix. */
export function buildUniquePaymentAmount(listPrice: number): {
  displayAmount: string;
  amountRaw: string;
} {
  const base = Math.max(0.01, listPrice);
  const suffix = Math.floor(Math.random() * 900_000) + 100_000;
  const fractional = suffix / 1_000_000_000;
  const total = Math.round((base + fractional) * 1e6) / 1e6;
  const displayAmount = total.toFixed(6).replace(/\.?0+$/, "") || total.toFixed(6);
  const amountRaw = parseUnits(displayAmount, USDT_DECIMALS).toString();
  return { displayAmount, amountRaw };
}

export function formatUsdtRaw(amountRaw: string): string {
  return formatUnits(BigInt(amountRaw), USDT_DECIMALS);
}

export function addressesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
