// Owner-page constants. The words are in src/i18n/messages.
import type { Currency } from "@/lib/currency";

export type { Lang } from "@/i18n/locales";

export const REGIONS = ["saimaa", "lakeland", "lapland", "helsinki", "coast", "other"] as const;
export type Region = (typeof REGIONS)[number];

export const CONTACT_EMAIL = "info@rantio.fi";

// Same assumptions as the business plan (28 Oct 2026).
export const PLATFORM_FEE = 0.15;
export const COMMISSION = 0.12;
export const YEARLY_FEE = 99;
export const VAT = 0.255;

/** The yearly fee as a set amount in each currency, so owners pay in their own money (about €99
 *  at the ECB rate of 2 Nov 2026). The server charges the same: backend/owners/models.py YEARLY_FEES. */
export const YEARLY_FEES: Record<Currency, number> = { EUR: YEARLY_FEE, SEK: 1080, NOK: 1030, DKK: 740, ISK: 13500 };

/** The owner page's estimator and example, in the page's currency: a typical night and the slider's range. */
export const NIGHT_PRICES: Record<Currency, { typical: number; min: number; max: number; step: number }> = {
  EUR: { typical: 150, min: 40, max: 1000, step: 10 },
  SEK: { typical: 1600, min: 400, max: 11000, step: 100 },
  NOK: { typical: 1550, min: 400, max: 10000, step: 100 },
  DKK: { typical: 1100, min: 300, max: 7500, step: 50 },
  ISK: { typical: 20000, min: 5000, max: 135000, step: 1000 },
};

export function ownerNetGain(nights: number, pricePerNight: number, currency: Currency = "EUR"): number {
  const payout = nights * pricePerNight * (1 - PLATFORM_FEE);
  const stugora = payout * COMMISSION * (1 + VAT) + YEARLY_FEES[currency] * (1 + VAT);
  return Math.max(0, payout - stugora);
}

// Store pages for the phone apps. Leave empty until the app is live in that store:
// an empty link shows the button as "Coming soon" instead of linking anywhere.
export const APP_LINKS = {
  ios: "",
  android: "",
};
