// Currencies. Each cottage is priced in its own country's currency; each guest sees
// prices in the currency they pick (by default the one their language's country uses).
// Converted prices are shown as "about", because guests pay on the booking site, which
// converts at its own rate.
import { money, number } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";

export const CURRENCIES = ["EUR", "SEK", "NOK", "DKK", "ISK"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** The currency each country Stugora covers uses. */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  FI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  IS: "ISK",
};

/** What a visitor sees first, from the page's language. */
export const LANG_CURRENCY: Record<Lang, Currency> = {
  en: "EUR",
  fi: "EUR",
  et: "EUR",
  lv: "EUR",
  lt: "EUR",
  sv: "SEK",
  nb: "NOK",
  nn: "NOK",
  da: "DKK",
  is: "ISK",
};

/** Units of each currency per 1 EUR. The site starts with these (ECB, 28 Oct 2026) and
 *  swaps in the European Central Bank's rates of the day from /api/rates/. */
export type Rates = Record<Currency, number>;
export const FALLBACK_RATES: Rates = { EUR: 1, SEK: 11.056, NOK: 10.3475, DKK: 7.4741, ISK: 135.8 };

export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return amount;
  return (amount / rates[from]) * rates[to];
}

/** Round a converted price the way a person would quote it: 1 237 → 1 240, 14 870 → 14 900. */
export function roundNicely(amount: number, currency: Currency): number {
  const step = currency === "ISK" ? (amount >= 10000 ? 500 : 100) : amount >= 1000 ? 10 : amount >= 100 ? 5 : 1;
  return Math.round(amount / step) * step;
}

// Where a currency is the language's own, it is written the local way ("1 450 kr");
// anywhere else with its code ("1 450 SEK"), so Swedish and Norwegian kronor never mix up.
const NATIVE: Partial<Record<Lang, Currency>> = { sv: "SEK", nb: "NOK", nn: "NOK", da: "DKK", is: "ISK" };

const NBSP = "\u00a0";

/** How the currency is marked on this page: "€", "kr" (on a Swedish page, for SEK) or "SEK". */
export function currencySign(lang: Lang, currency: Currency): string {
  if (currency === "EUR") return "€";
  if (NATIVE[lang] === currency) return currency === "ISK" ? "kr." : "kr";
  return currency;
}

/** "€180" / "180 €", "1 450 kr" on a Swedish page, "SEK 1,450" in English, "1 450 SEK" in Finnish. */
export function formatPrice(lang: Lang, amount: number, currency: Currency, cents = false): string {
  if (currency === "EUR" && !cents) return money(lang, amount);
  const n = cents ? number(lang, amount, { min: 2, max: 2 }) : number(lang, Math.round(amount));
  const sign = currencySign(lang, currency);
  if (lang === "en" && currency === "EUR") return `€${n}`;
  return lang === "en" && sign === currency ? `${currency}${NBSP}${n}` : `${n}${NBSP}${sign}`;
}
