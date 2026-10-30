// The guest side's other pages: Experiences, Destinations and Inspiration.
// Words are in each language's messages (explore); photos come from the example
// cottages, so every picture on these pages is one guests also see on a cottage.
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import type { ActivityId } from "./activities";
import type { FeatureKey } from "./catalog";
import { type Category, type Country, getListing, LISTINGS, type PhotoKind } from "./listings";

export type Season = "summer" | "autumn" | "winter" | "allYear";

/** Which cottages a page links to: the same filters the homepage keeps in its address. */
export type CottageQuery = {
  cat?: Exclude<Category, "all">;
  f?: FeatureKey;
  country?: Country;
  region?: string;
};

/** A photo of an example cottage: its main photo, or the first of a kind from its gallery. */
export function cottagePhoto(id: string, kind?: Exclude<PhotoKind, "exterior">, nth = 0): string {
  const l = getListing(id);
  if (!l) throw new Error(`No example cottage "${id}"`);
  if (!kind) return l.photo;
  const photos = (l.gallery ?? []).filter(([k]) => k === kind);
  return (photos[nth] ?? photos[0])?.[1] ?? l.photo;
}

/** Link to the homepage's list of cottages with these filters on. */
export function cottagesHref(lang: Lang, q: CottageQuery = {}): string {
  const s = new URLSearchParams();
  if (q.cat) s.set("cat", q.cat);
  if (q.country) s.set("country", q.country);
  if (q.region) s.set("region", q.region);
  if (q.f) s.set("f", q.f);
  const query = s.toString();
  return `${paths.home(lang)}${query ? `?${query}` : ""}#majoitus`;
}

/** How many example cottages a link would show. */
export function countCottages(q: CottageQuery): number {
  return LISTINGS.filter(
    (l) =>
      (!q.cat || l.categories.includes(q.cat)) &&
      (!q.f || l.features.includes(q.f)) &&
      (!q.country || l.country === q.country) &&
      (!q.region || l.region === q.region),
  ).length;
}

// ---------- Experiences ----------
export const EXPERIENCE_IDS = ["sauna", "swim", "paddling", "fishing", "hiking", "aurora", "skiing", "dogs"] as const;
export type ExperienceId = (typeof EXPERIENCE_IDS)[number];

export const EXPERIENCES: Record<ExperienceId, { icon: ActivityId; season: Season; photo: string; query: CottageQuery }> = {
  sauna: { icon: "sauna", season: "allYear", photo: cottagePhoto("lakeside-villa", "sauna"), query: { cat: "sauna" } },
  swim: { icon: "swim", season: "summer", photo: cottagePhoto("archipelago-villa"), query: { cat: "waterfront" } },
  paddling: { icon: "paddling", season: "summer", photo: cottagePhoto("lake-house-latgale"), query: { f: "canoe" } },
  fishing: { icon: "fishing", season: "allYear", photo: cottagePhoto("lofoten-rorbu"), query: { f: "boat" } },
  hiking: { icon: "foraging", season: "autumn", photo: cottagePhoto("nuuksio-forest-cabin"), query: { cat: "forest" } },
  aurora: { icon: "aurora", season: "winter", photo: cottagePhoto("arctic-cabin"), query: { cat: "aurora" } },
  skiing: { icon: "downhill", season: "winter", photo: cottagePhoto("ski-stuga"), query: { cat: "skiing" } },
  dogs: { icon: "dogs", season: "allYear", photo: cottagePhoto("red-stuga"), query: { cat: "pets" } },
};

// ---------- Destinations ----------
/** Each country's picture, and the regions where example cottages are, most cottages first. */
export function destination(country: Country) {
  const here = LISTINGS.filter((l) => l.country === country);
  const counts = new Map<string, number>();
  for (const l of here) counts.set(l.region, (counts.get(l.region) ?? 0) + 1);
  return {
    photo: here[0]?.photo,
    count: here.length,
    regions: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, count: n })),
  };
}

// ---------- Inspiration ----------
export const GUIDE_IDS = ["sauna", "aurora", "everyman", "midsummer", "winter"] as const;
export type GuideId = (typeof GUIDE_IDS)[number];
export const isGuide = (id: string): id is GuideId => (GUIDE_IDS as readonly string[]).includes(id);

export const GUIDES: Record<GuideId, { photo: string; query: CottageQuery }> = {
  sauna: { photo: cottagePhoto("modern-forest-retreat", "sauna"), query: { cat: "sauna" } },
  aurora: { photo: cottagePhoto("fjord-house"), query: { cat: "aurora" } },
  everyman: { photo: cottagePhoto("red-stuga", "outside"), query: { cat: "forest" } },
  midsummer: { photo: cottagePhoto("lohja-lake-cabin"), query: { cat: "waterfront" } },
  winter: { photo: cottagePhoto("ski-stuga", "outside"), query: { cat: "skiing" } },
};

/** Reading time from the guide's own words, at about 200 words a minute. */
export function readingMinutes(texts: string[]): number {
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
