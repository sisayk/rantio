// Owner-page constants. The words are in src/i18n/messages.
import type { Currency } from "@/lib/currency";

export type { Lang } from "@/i18n/locales";

export const CONTACT_EMAIL = "info@rantio.fi";

// The commission, free months, yearly fees and the booking sites' fee are set in the admin
// (Settings → Prices): see lib/prices.ts.

/** The owner page's estimator and example, in the page's currency: a typical night and the slider's range. */
export const NIGHT_PRICES: Record<Currency, { typical: number; min: number; max: number; step: number }> = {
  EUR: { typical: 150, min: 40, max: 1000, step: 10 },
  SEK: { typical: 1600, min: 400, max: 11000, step: 100 },
  NOK: { typical: 1550, min: 400, max: 10000, step: 100 },
  DKK: { typical: 1100, min: 300, max: 7500, step: 50 },
  ISK: { typical: 20000, min: 5000, max: 135000, step: 1000 },
};

// Store pages for the phone apps. Leave empty until the app is live in that store:
// an empty link shows the button as "Coming soon" instead of linking anywhere.
export const APP_LINKS = {
  ios: "",
  android: "",
};

/** Rantio's own social media accounts. Fill in an account's full address and its icon appears at
 *  the bottom of every page (SiteFooter.tsx); an empty one stays hidden, so there's never a link
 *  to an account that doesn't exist yet. */
export const SOCIAL = {
  instagram: "",
  facebook: "",
  tiktok: "",
  x: "",
  youtube: "",
  threads: "",
  pinterest: "",
} as const satisfies Record<string, string>;
