// Owner-page constants. The words are in src/i18n/messages.
export type { Lang } from "@/i18n/locales";

export const REGIONS = ["saimaa", "lakeland", "lapland", "helsinki", "coast", "other"] as const;
export type Region = (typeof REGIONS)[number];

export const CONTACT_EMAIL = "hello@rantio.fi";

// Same assumptions as the business plan (28 Oct 2026).
export const PLATFORM_FEE = 0.15;
export const COMMISSION = 0.12;
export const YEARLY_FEE = 99;
export const VAT = 0.255;

export function ownerNetGain(nights: number, pricePerNight: number): number {
  const payout = nights * pricePerNight * (1 - PLATFORM_FEE);
  const stugora = payout * COMMISSION * (1 + VAT) + YEARLY_FEE * (1 + VAT);
  return Math.max(0, payout - stugora);
}

// Store pages for the phone apps. Leave empty until the app is live in that store:
// an empty link shows the button as "Coming soon" instead of linking anywhere.
export const APP_LINKS = {
  ios: "",
  android: "",
};
