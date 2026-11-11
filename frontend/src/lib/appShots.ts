// Screenshots of the app for the footer's "Take Rantio with you" band, one set per site language, taken
// with the app in that language (mobile/scripts/site-shots.sh, then resized to 360 px wide WebP in
// assets/app/<lang>/). A language without its own set shows the phones drawn in HTML instead, which
// are always in the page's language: a page never shows the app in another language.
// Swedish is still to come:  LANGS=sv bash ~/stugora/mobile/scripts/site-shots.sh
import type { StaticImageData } from "next/image";
import enExplore from "@/assets/app/en/explore.webp";
import enMap from "@/assets/app/en/map.webp";
import fiExplore from "@/assets/app/fi/explore.webp";
import fiMap from "@/assets/app/fi/map.webp";
import nbExplore from "@/assets/app/nb/explore.webp";
import nbMap from "@/assets/app/nb/map.webp";
import nnExplore from "@/assets/app/nn/explore.webp";
import nnMap from "@/assets/app/nn/map.webp";
import daExplore from "@/assets/app/da/explore.webp";
import daMap from "@/assets/app/da/map.webp";
import isExplore from "@/assets/app/is/explore.webp";
import isMap from "@/assets/app/is/map.webp";
import etExplore from "@/assets/app/et/explore.webp";
import etMap from "@/assets/app/et/map.webp";
import lvExplore from "@/assets/app/lv/explore.webp";
import lvMap from "@/assets/app/lv/map.webp";
import ltExplore from "@/assets/app/lt/explore.webp";
import ltMap from "@/assets/app/lt/map.webp";
import deExplore from "@/assets/app/de/explore.webp";
import deMap from "@/assets/app/de/map.webp";
import type { Lang } from "@/i18n/locales";

export type AppShots = { explore: StaticImageData; map: StaticImageData };

export const APP_SHOTS: Partial<Record<Lang, AppShots>> = {
  en: { explore: enExplore, map: enMap },
  fi: { explore: fiExplore, map: fiMap },
  nb: { explore: nbExplore, map: nbMap },
  nn: { explore: nnExplore, map: nnMap },
  da: { explore: daExplore, map: daMap },
  is: { explore: isExplore, map: isMap },
  et: { explore: etExplore, map: etMap },
  lv: { explore: lvExplore, map: lvMap },
  lt: { explore: ltExplore, map: ltMap },
  de: { explore: deExplore, map: deMap },
};
