// What the listings page, the editor and the Overview panel share.
import type { Lang } from "@/i18n/locales";
import { LANG_INFO } from "@/i18n/locales";
import type { ChecklistKey, ListingFields, ListingPhoto, ListingStatus } from "@/lib/ownerApi";

export const SECTIONS = ["overview", "basics", "photos", "amenities", "pricing", "rules", "arrival", "location", "calendar", "reviews", "status"] as const;
export type Section = (typeof SECTIONS)[number];

/** Where in the editor each checklist item is done. */
export const CHECK_SECTION: Record<ChecklistKey, Section> = {
  cover: "photos",
  photos: "photos",
  description: "basics",
  location: "location",
  price: "pricing",
  pin: "location",
  amenities: "amenities",
  rules: "rules",
  arrival: "arrival",
  availability: "calendar",
};

const ESSENTIAL: ChecklistKey[] = ["cover", "description", "location", "price"];

/** The same list the server checks before publishing (backend/owners/listings.py checklist),
 *  worked out here too so it updates while the owner types. */
export function checklist(f: ListingFields, photos: ListingPhoto[], connectedSites: number) {
  const done: Record<ChecklistKey, boolean> = {
    cover: photos.length >= 1,
    description: Object.values(f.descriptions).some((v) => v.trim()),
    location: Boolean(f.municipality.trim()),
    price: Number(f.price_per_night) > 0,
    photos: photos.length >= 5,
    pin: f.latitude !== null && f.longitude !== null,
    amenities: f.amenities.length >= 3,
    rules: Boolean(f.check_in_from && f.check_out_by),
    arrival: Boolean(f.arrival_instructions.trim()),
    availability: connectedSites > 0,
  };
  const items = (Object.keys(done) as ChecklistKey[]).map((key) => ({ key, done: done[key], essential: ESSENTIAL.includes(key) }));
  return { items, pct: Math.round((100 * items.filter((i) => i.done).length) / items.length) };
}

export const LANG_CODES = Object.keys(LANG_INFO) as Lang[];

/** Statuses the owner can act on, and what each action is called in the messages. */
export function actionsFor(status: ListingStatus): ("publish" | "pause" | "relist" | "archive" | "restore")[] {
  switch (status) {
    case "intake":
      return ["publish", "archive"];
    case "listing":
      return ["publish", "pause", "archive"];
    case "live":
      return ["pause", "archive"];
    case "paused":
      return ["relist", "archive"];
    case "archived":
      return ["restore"];
  }
}

const parseDay = (iso: string) => new Date(`${iso}T12:00:00`);

export function dateFormats(lang: Lang) {
  const intl = LANG_INFO[lang].intl;
  const day = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  const full = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" });
  const stamp = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return {
    day: (iso: string) => day.format(parseDay(iso)),
    full: (iso: string) => full.format(new Date(iso)),
    stamp: (iso: string) => stamp.format(new Date(iso)),
    range: (a: string, b: string) => `${day.format(parseDay(a))} – ${day.format(parseDay(b))}`,
  };
}
