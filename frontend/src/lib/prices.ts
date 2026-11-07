// Rantio's prices as set in the admin (Settings → Prices; GET /api/pricing/): the commission, the
// free months and the yearly fee in each currency. The website reads them on the server
// (prices.server.ts), the owner pages and the app in the browser (usePrices.ts). DEFAULT_PRICES is
// only for when the API can't be reached; it matches what the admin starts with.
import { type Lang } from "@/i18n/locales";
import { number, plural } from "@/i18n/format";
import { TRIAL } from "@/i18n/messages/trial";
import type { Currency } from "@/lib/currency";

export type Prices = {
  /** Percent of the owner's payout, before VAT (12 = 12 %). */
  commission: number;
  trialMonths: number;
  /** Per cottage, before VAT, in each currency. */
  yearlyFees: Record<Currency, number>;
  /** About what the booking sites keep, in percent: only for the example and the estimate. */
  platformFee: number;
  /** Finnish VAT in percent. */
  vat: number;
};

export const DEFAULT_PRICES: Prices = {
  commission: 12,
  trialMonths: 3,
  yearlyFees: { EUR: 99, SEK: 1080, NOK: 1030, DKK: 740, ISK: 13500 },
  platformFee: 15,
  vat: 25.5,
};

type ApiPrices = {
  commission_rate: number;
  trial_months: number;
  yearly_fees: Record<Currency, number>;
  platform_fee: number;
  vat_rate: number;
};

export function fromApi(v: ApiPrices | null | undefined): Prices {
  if (!v || typeof v.commission_rate !== "number") return DEFAULT_PRICES;
  return {
    commission: v.commission_rate,
    trialMonths: v.trial_months,
    yearlyFees: { ...DEFAULT_PRICES.yearlyFees, ...v.yearly_fees },
    platformFee: v.platform_fee,
    vat: v.vat_rate,
  };
}

/** "12" or "12,5", as the language writes it (the % sign is in the sentence). */
export const percent = (lang: Lang, n: number) => number(lang, n, { max: 2 });

/** "3 months", in the case each language's trial sentences use (TRIAL[lang].period). */
export const period = (lang: Lang, months: number) => plural(lang, TRIAL[lang].period, months);

/** Every {commission}, {platformFee} and {period} in a part of the messages, filled in; other placeholders stay. */
export function withPrices<T>(lang: Lang, tree: T, prices: Prices): T {
  const vars: Record<string, string> = {
    commission: percent(lang, prices.commission),
    platformFee: percent(lang, prices.platformFee),
    period: period(lang, prices.trialMonths),
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/\{(commission|period|platformFee)\}/g, (_, k: string) => vars[k]);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(tree) as T;
}

/** What the owner keeps from extra nights after the sites' fees, Rantio's commission and yearly fee, and VAT. */
export function ownerNetGain(prices: Prices, nights: number, pricePerNight: number, currency: Currency = "EUR"): number {
  const vat = 1 + prices.vat / 100;
  const payout = nights * pricePerNight * (1 - prices.platformFee / 100);
  const rantio = payout * (prices.commission / 100) * vat + prices.yearlyFees[currency] * vat;
  return Math.max(0, payout - rantio);
}
