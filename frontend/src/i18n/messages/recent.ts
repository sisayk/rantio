import type { Lang } from "../locales";

/** "Recently viewed" at the top of the app's Explore, as in Airbnb's app: the cottages opened
 *  on this phone, newest first. Kept apart from the big message files. */
export type RecentText = {
  title: string;
  seeAll: string;
  clear: string;
};

export const RECENT: Record<Lang, RecentText> = {
  en: { title: "Recently viewed", seeAll: "See all", clear: "Clear" },
  fi: { title: "Viimeksi katsotut", seeAll: "Näytä kaikki", clear: "Tyhjennä" },
  sv: { title: "Nyligen visade", seeAll: "Visa alla", clear: "Rensa" },
  nb: { title: "Nylig sett", seeAll: "Vis alle", clear: "Tøm" },
  nn: { title: "Nyleg sett", seeAll: "Vis alle", clear: "Tøm" },
  da: { title: "Senest set", seeAll: "Se alle", clear: "Ryd" },
  is: { title: "Nýlega skoðað", seeAll: "Sjá allt", clear: "Hreinsa" },
  et: { title: "Hiljuti vaadatud", seeAll: "Vaata kõiki", clear: "Tühjenda" },
  lv: { title: "Nesen skatītie", seeAll: "Skatīt visus", clear: "Notīrīt" },
  lt: { title: "Neseniai peržiūrėti", seeAll: "Žiūrėti visus", clear: "Išvalyti" },
  de: { title: "Zuletzt angesehen", seeAll: "Alle ansehen", clear: "Leeren" },
};
