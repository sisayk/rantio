// What guests can do at and around a cottage, worked out from the cottage's own
// details (shore, sauna, boat, ski area, ...) and its country. Nothing here is
// invented per cottage: an activity shows only when the listing's data supports it.
// The words are in each language's messages (activities).
import type { Messages } from "@/i18n";
import type { Country, Listing } from "./listings";

export type Season = "summer" | "winter" | "autumn" | "darkSeason" | "allYear";
type Words = Messages["activities"];
type Water = "lake" | "sea" | "river" | "pond";

export type ActivityId =
  | "swim"
  | "beach"
  | "sauna"
  | "rowing"
  | "paddling"
  | "fishing"
  | "iceFishing"
  | "hiking"
  | "foraging"
  | "downhill"
  | "crossCountry"
  | "snowshoe"
  | "aurora"
  | "hotTub"
  | "campfire"
  | "fireside"
  | "dogs";

const has = (l: Listing, ...keys: string[]) => keys.some((k) => (l.features as string[]).includes(k));
const cat = (l: Listing, c: string) => (l.categories as string[]).includes(c);

// Everyman's right (jokamiehenoikeus / allemansrätten / allemannsretten) lets anyone
// pick wild berries and mushrooms in these countries.
const FORAGING_COUNTRIES: Country[] = ["FI", "SE", "NO", "EE"];
// Sandy sea beaches are the draw on these coasts.
const BEACH_COUNTRIES: Country[] = ["DK", "LT", "EE"];
// Lakes here normally freeze over in winter.
const ICE_COUNTRIES: Country[] = ["FI", "SE", "NO", "EE", "LV", "LT"];

const water = (l: Listing): Water => (has(l, "lake") ? "lake" : has(l, "sea") ? "sea" : has(l, "river") ? "river" : "pond");
const fillKind = (template: string, kind: string) => template.replace("{kind}", kind);

type Rule = { id: ActivityId; season: Season; when: (l: Listing) => boolean; text: (w: Words, l: Listing) => [string, string] };

const RULES: Rule[] = [
  {
    id: "swim",
    season: "summer",
    when: (l) => has(l, "lake", "river", "pond") || (has(l, "sea") && !BEACH_COUNTRIES.includes(l.country)),
    text: (w, l) => [w.swim.title, has(l, "privateShore") ? w.swim.ownShore[water(l)] : w.swim.walk[water(l)]],
  },
  {
    id: "beach",
    season: "summer",
    when: (l) => has(l, "sea") && BEACH_COUNTRIES.includes(l.country),
    text: (w) => [w.beach.title, w.beach.body],
  },
  {
    id: "sauna",
    season: "allYear",
    when: (l) => has(l, "electricSauna", "woodSauna", "smokeSauna"),
    text: (w, l) => {
      const kind = has(l, "smokeSauna") ? w.sauna.kinds.smoke : has(l, "woodSauna") ? w.sauna.kinds.wood : w.sauna.kinds.electric;
      const body = has(l, "lake", "sea", "river", "pond") ? w.sauna.withWater[water(l)] : w.sauna.atCottage;
      return [w.sauna.title, fillKind(body, kind)];
    },
  },
  { id: "rowing", season: "summer", when: (l) => has(l, "boat"), text: (w) => [w.rowing.title, w.rowing.body] },
  { id: "paddling", season: "summer", when: (l) => has(l, "canoe"), text: (w) => [w.paddling.title, w.paddling.body] },
  {
    id: "fishing",
    season: "summer",
    when: (l) => has(l, "lake", "sea", "river") && has(l, "boat", "jetty", "privateShore"),
    text: (w) => [w.fishing.title, w.fishing.body],
  },
  {
    id: "iceFishing",
    season: "winter",
    when: (l) => has(l, "lake") && ICE_COUNTRIES.includes(l.country),
    text: (w) => [w.iceFishing.title, w.iceFishing.body],
  },
  {
    id: "hiking",
    season: "allYear",
    when: (l) => cat(l, "forest") || cat(l, "aurora") || cat(l, "skiing"),
    text: (w) => [w.hiking.title, w.hiking.body],
  },
  {
    id: "foraging",
    season: "autumn",
    when: (l) => cat(l, "forest") && FORAGING_COUNTRIES.includes(l.country),
    text: (w) => [w.foraging.title, w.foraging.body],
  },
  { id: "downhill", season: "winter", when: (l) => has(l, "nearSki"), text: (w) => [w.downhill.title, w.downhill.body] },
  {
    id: "crossCountry",
    season: "winter",
    when: (l) => has(l, "nearSki") || cat(l, "skiing"),
    text: (w) => [w.crossCountry.title, w.crossCountry.body],
  },
  {
    id: "snowshoe",
    season: "winter",
    when: (l) => cat(l, "skiing") || (cat(l, "aurora") && ["FI", "SE"].includes(l.country)),
    text: (w) => [w.snowshoe.title, w.snowshoe.body],
  },
  { id: "aurora", season: "darkSeason", when: (l) => cat(l, "aurora"), text: (w) => [w.aurora.title, w.aurora.body] },
  {
    id: "hotTub",
    season: "allYear",
    when: (l) => has(l, "hotTub", "outdoorJacuzzi", "jacuzzi"),
    text: (w, l) => [w.hotTub.title, has(l, "hotTub") ? w.hotTub.tub : w.hotTub.jacuzzi],
  },
  { id: "campfire", season: "allYear", when: (l) => has(l, "grillHut"), text: (w) => [w.campfire.title, w.campfire.body] },
  { id: "fireside", season: "allYear", when: (l) => has(l, "fireplace"), text: (w) => [w.fireside.title, w.fireside.body] },
  { id: "dogs", season: "allYear", when: (l) => has(l, "pets"), text: (w) => [w.dogs.title, w.dogs.body] },
];

export type ActivityItem = { id: ActivityId; season: Season; title: string; body: string };

export function activitiesFor(l: Listing, words: Words): ActivityItem[] {
  return RULES.filter((r) => r.when(l)).map((r) => {
    const [title, body] = r.text(words, l);
    return { id: r.id, season: r.season, title, body };
  });
}
