import { NextResponse } from "next/server";
import {
  currencyOptions,
  getDefaultCurrency,
  CURRENCIES,
} from "@/lib/currency";

export async function GET() {
  const defaultCurrency = getDefaultCurrency();

  return NextResponse.json({
    defaultCurrency,
    currencies: currencyOptions(),
    label: CURRENCIES[defaultCurrency].name,
  });
}
