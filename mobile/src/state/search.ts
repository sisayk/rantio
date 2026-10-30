// Searching and filtering the cottages, as the website's guest homepage does.
import { BEDROOM_CHOICES } from "@/lib/catalog";
import { type Category, COUNTRIES, type Country, type Listing, listingCurrency, LISTINGS } from "@/lib/listings";
import { PLACES } from "@/lib/places";
import { CITY_ALIASES } from "@/lib/placeNames";
import type { Rates } from "@/lib/currency";
import { convert } from "@/lib/currency";
import { NAMES } from "@/text/names";

export type Sort = "recommended" | "priceLow" | "priceHigh" | "guests";

export type Filters = {
  query: string;
  category: Category;
  country: Country | null;
  guests: number;
  bedrooms: number; // 0 = any; 4 means 4 or more
  instantBook: boolean;
  freeCancellation: boolean;
  sort: Sort;
};

export const NO_FILTERS: Filters = {
  query: "",
  category: "all",
  country: null,
  guests: 0,
  bedrooms: 0,
  instantBook: false,
  freeCancellation: false,
  sort: "recommended",
};

export { BEDROOM_CHOICES, COUNTRIES };

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th");

/** Every word a cottage can be found by, in every language: town, region, country, name. */
const haystacks = new Map<string, string>();
function haystack(l: Listing, names: Record<string, string>): string {
  let base = haystacks.get(l.id);
  if (base === undefined) {
    const region = PLACES[l.country]?.find((r) => r.id === l.region);
    const countryNames = Object.values(NAMES).map((n) => (n.country as Record<string, string>)[l.country]);
    base = fold(
      [l.place, l.city, ...(CITY_ALIASES[l.city] ?? []), region?.name.en, region?.name.fi, region?.name.local, l.country, ...countryNames]
        .filter(Boolean)
        .join(" | "),
    );
    haystacks.set(l.id, base);
  }
  return `${base} | ${fold(names[l.id] ?? "")}`;
}

export function search(f: Filters, names: Record<string, string>, rates: Rates): Listing[] {
  const words = fold(f.query).split(/[\s,]+/).filter(Boolean);
  const hits = LISTINGS.filter((l) => {
    if (f.category !== "all" && !l.categories.includes(f.category)) return false;
    if (f.country && l.country !== f.country) return false;
    if (f.guests && l.guests < f.guests) return false;
    if (f.bedrooms && (f.bedrooms >= 4 ? l.bedrooms < 4 : l.bedrooms < f.bedrooms)) return false;
    if (f.instantBook && !l.features.includes("instantBook")) return false;
    if (f.freeCancellation && !l.features.includes("freeCancellation")) return false;
    if (words.length) {
      const hay = haystack(l, names);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const eur = (l: Listing) => convert(l.price, listingCurrency(l), "EUR", rates);
  if (f.sort === "priceLow") hits.sort((a, b) => eur(a) - eur(b));
  if (f.sort === "priceHigh") hits.sort((a, b) => eur(b) - eur(a));
  if (f.sort === "guests") hits.sort((a, b) => b.guests - a.guests);
  return hits;
}

/** How many filters (beyond the search words and category) are on, for the button's count. */
export const activeFilters = (f: Filters) =>
  [f.country, f.guests, f.bedrooms, f.instantBook, f.freeCancellation, f.sort !== "recommended"].filter(Boolean).length;
