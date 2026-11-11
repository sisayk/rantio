// Screenshots of the app for the footer's "Take Rantio with you" band, one set per site language, taken
// with the app in that language (mobile/scripts/site-shots.sh, then resized to 360 px wide WebP in
// assets/app/<lang>/). A language without its own set shows the phones drawn in HTML instead, which
// are always in the page's language: a page never shows the app in another language.
import type { StaticImageData } from "next/image";
import fiExplore from "@/assets/app/fi/explore.webp";
import fiMap from "@/assets/app/fi/map.webp";
import type { Lang } from "@/i18n/locales";

export type AppShots = { explore: StaticImageData; map: StaticImageData };

export const APP_SHOTS: Partial<Record<Lang, AppShots>> = {
  fi: { explore: fiExplore, map: fiMap },
};
