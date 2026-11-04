// What a cottage can have, how guests filter on it, and where it is listed.
// ---------- listing sites ----------
// Icons are each site's own favicon, which Rantio's server fetches once and serves
// (backend/owners/site_icons.py, whose SITES list must match this one); no logos are stored here.
export const CHANNELS = {
  airbnb: { name: "Airbnb", domain: "airbnb.com" },
  booking: { name: "Booking.com", domain: "booking.com" },
  vrbo: { name: "Vrbo", domain: "vrbo.com" },
  expedia: { name: "Expedia", domain: "expedia.com" },
  agoda: { name: "Agoda", domain: "agoda.com" },
  google: { name: "Google Vacation Rentals", domain: "google.com" },
  holidu: { name: "Holidu", domain: "holidu.com" },
  hometogo: { name: "HomeToGo", domain: "hometogo.com" },
  nettimokki: { name: "Nettimökki", domain: "nettimokki.com" },
  lomarengas: { name: "Lomarengas", domain: "lomarengas.fi" },
  mokkivuokra: { name: "Mökkivuokra", domain: "mokkivuokra.fi" },
  novasol: { name: "Novasol", domain: "novasol.com" },
  stugsommar: { name: "Stugsommar", domain: "stugsommar.se" },
  finn: { name: "FINN", domain: "finn.no" },
  inatur: { name: "Inatur", domain: "inatur.no" },
  dancenter: { name: "DanCenter", domain: "dancenter.com" },
  sologstrand: { name: "Sol og Strand", domain: "sologstrand.dk" },
} as const;
export type ChannelId = keyof typeof CHANNELS;

// Sites Rantio lists on in each country, most-used first.
const GLOBAL: ChannelId[] = ["airbnb", "booking", "vrbo", "expedia", "agoda", "google", "holidu", "hometogo"];
export const CHANNELS_BY_COUNTRY: Record<string, ChannelId[]> = {
  FI: [...GLOBAL, "nettimokki", "lomarengas", "mokkivuokra"],
  SE: [...GLOBAL, "novasol", "stugsommar"],
  NO: [...GLOBAL, "finn", "inatur", "novasol"],
  DK: [...GLOBAL, "novasol", "dancenter", "sologstrand"],
  IS: GLOBAL,
  EE: GLOBAL,
  LV: GLOBAL,
  LT: GLOBAL,
};

/** The site's icon from Rantio's own server; the app passes its server address as `base`. */
export const channelIcon = (id: ChannelId, base = "") => `${base}/api/site-icon/${id}/`;

// ---------- filter sections ----------
// "any": a cottage matches if it has one of the ticked options (water, shore, sauna).
// "all": it must have every ticked option (kitchen, features).
// The labels are in each language's messages (catalog.groups and catalog.features).
type Group = { id: string; match: "any" | "all"; options: readonly string[] };

export const FEATURE_GROUPS = [
  { id: "booking", match: "all", options: ["instantBook", "freeCancellation"] },
  { id: "water", match: "any", options: ["lake", "sea", "river", "pond"] },
  { id: "shore", match: "any", options: ["privateShore", "sharedShore", "shoreAccess", "waterAccess"] },
  {
    id: "kitchen",
    match: "all",
    options: ["dishwasher", "fridge", "cooking", "microwave", "freezer", "stove", "oven", "coffeeMaker", "grillHut"],
  },
  { id: "sauna", match: "any", options: ["electricSauna", "smokeSauna", "woodSauna"] },
  {
    id: "features",
    match: "all",
    options: [
      "nearSki", "internet", "dryingCabinet", "tumbleDryer", "jetty", "loft", "hotTub", "jacuzzi",
      "washingMachine", "highChair", "shower", "evCharging", "fireplace", "tv", "pool", "outdoorJacuzzi",
      "babyBed", "noElectricity", "solarPower", "carriedWater", "heatPump", "indoorWc", "outdoorWc",
      "boat", "canoe", "pets",
    ],
  },
  { id: "accessibility", match: "all", options: ["wheelchair"] },
] as const satisfies readonly Group[];

type Groups = typeof FEATURE_GROUPS;
export type FeatureKey = Groups[number]["options"][number];
export type GroupId = Groups[number]["id"];

export const BEDROOM_CHOICES = [1, 2, 3, 4] as const; // 4 means 4 or more
