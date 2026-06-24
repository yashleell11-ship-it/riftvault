export const CURRENCY_CODES = ["ETH", "USDT", "BNB", "BTC"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const CURRENCIES: Record<
  CurrencyCode,
  { symbol: string; name: string; decimals: number }
> = {
  ETH: { symbol: "ETH", name: "Ethereum", decimals: 4 },
  USDT: { symbol: "USDT", name: "Tether USD", decimals: 2 },
  BNB: { symbol: "BNB", name: "BNB", decimals: 4 },
  BTC: { symbol: "BTC", name: "Bitcoin", decimals: 6 },
};

export function normalizeCurrency(code?: string | null): CurrencyCode {
  const upper = (code ?? "").toUpperCase();
  if ((CURRENCY_CODES as readonly string[]).includes(upper)) {
    return upper as CurrencyCode;
  }
  return getDefaultCurrency();
}

/** Platform default — set NEXT_PUBLIC_DEFAULT_CURRENCY in .env (ETH | USDT | BNB | BTC) */
export function getDefaultCurrency(): CurrencyCode {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "USDT";
  const upper = raw.toUpperCase();
  if ((CURRENCY_CODES as readonly string[]).includes(upper)) {
    return upper as CurrencyCode;
  }
  return "USDT";
}

export function formatPrice(value: number, currency?: string | null): string {
  const code = currency ? normalizeCurrency(currency) : getDefaultCurrency();
  const { symbol, decimals } = CURRENCIES[code];
  const places = value < 1 ? decimals : Math.min(decimals, 2);
  return `${value.toFixed(places)} ${symbol}`;
}

export function currencyOptions() {
  return CURRENCY_CODES.map((code) => ({
    code,
    ...CURRENCIES[code],
  }));
}
