// What a cottage can have, how guests filter on it, and where it is listed.
import type { Lang } from "./content";

type Label = Record<Lang, string>;

// ---------- listing sites ----------
// Icons are each site's own favicon, loaded from the site; no logos are stored here.
export const CHANNELS = {
  airbnb: { name: "Airbnb", domain: "airbnb.com" },
  booking: { name: "Booking.com", domain: "booking.com" },
  vrbo: { name: "Vrbo", domain: "vrbo.com" },
  expedia: { name: "Expedia", domain: "expedia.com" },
  google: { name: "Google Vacation Rentals", domain: "google.com" },
  holidu: { name: "Holidu", domain: "holidu.com" },
  hometogo: { name: "HomeToGo", domain: "hometogo.com" },
  nettimokki: { name: "Nettimökki", domain: "nettimokki.com" },
  lomarengas: { name: "Lomarengas", domain: "lomarengas.fi" },
  novasol: { name: "Novasol", domain: "novasol.com" },
  stugsommar: { name: "Stugsommar", domain: "stugsommar.se" },
  finn: { name: "FINN", domain: "finn.no" },
  inatur: { name: "Inatur", domain: "inatur.no" },
  dancenter: { name: "DanCenter", domain: "dancenter.com" },
  sologstrand: { name: "Sol og Strand", domain: "sologstrand.dk" },
} as const;
export type ChannelId = keyof typeof CHANNELS;

// Sites Stugora lists on in each country, most-used first.
const GLOBAL: ChannelId[] = ["airbnb", "booking", "vrbo", "expedia", "google", "holidu", "hometogo"];
export const CHANNELS_BY_COUNTRY: Record<string, ChannelId[]> = {
  FI: [...GLOBAL, "nettimokki", "lomarengas"],
  SE: [...GLOBAL, "novasol", "stugsommar"],
  NO: [...GLOBAL, "finn", "inatur", "novasol"],
  DK: [...GLOBAL, "novasol", "dancenter", "sologstrand"],
  IS: GLOBAL,
  EE: GLOBAL,
  LV: GLOBAL,
  LT: GLOBAL,
};

export const channelIcon = (id: ChannelId) =>
  `https://www.google.com/s2/favicons?domain=${CHANNELS[id].domain}&sz=64`;

// ---------- filter sections ----------
// "any": a cottage matches if it has one of the ticked options (water, shore, sauna).
// "all": it must have every ticked option (kitchen, features).
type Group = { id: string; title: Label; match: "any" | "all"; options: Record<string, Label> };

export const FEATURE_GROUPS = [
  {
    id: "booking",
    title: { fi: "Varaus", en: "Booking" },
    match: "all",
    options: {
      instantBook: { fi: "Pikavaraus", en: "Instant book" },
      freeCancellation: { fi: "Ilmainen peruutus", en: "Free cancellation" },
    },
  },
  {
    id: "water",
    title: { fi: "Vesistön tyyppi", en: "Type of water" },
    match: "any",
    options: {
      lake: { fi: "Järvi", en: "Lake" },
      sea: { fi: "Meri", en: "Sea" },
      river: { fi: "Joki", en: "River" },
      pond: { fi: "Lampi", en: "Pond" },
    },
  },
  {
    id: "shore",
    title: { fi: "Ranta", en: "Shore" },
    match: "any",
    options: {
      privateShore: { fi: "Oma ranta", en: "Private shore" },
      sharedShore: { fi: "Jaettu ranta", en: "Shared shore" },
      shoreAccess: { fi: "Käyttöoikeus rantaan", en: "Right to use a shore" },
      waterAccess: { fi: "Käyttöoikeus vesialueisiin", en: "Right to use the water area" },
    },
  },
  {
    id: "kitchen",
    title: { fi: "Keittiön varusteet", en: "Kitchen" },
    match: "all",
    options: {
      dishwasher: { fi: "Astianpesukone", en: "Dishwasher" },
      fridge: { fi: "Jääkaappi", en: "Fridge" },
      cooking: { fi: "Keittomahdollisuus", en: "Cooking facilities" },
      microwave: { fi: "Mikroaaltouuni", en: "Microwave" },
      freezer: { fi: "Pakastin", en: "Freezer" },
      stove: { fi: "Liesi", en: "Stove" },
      oven: { fi: "Uuni", en: "Oven" },
      coffeeMaker: { fi: "Kahvinkeitin", en: "Coffee maker" },
      grillHut: { fi: "Grillikota", en: "Grill hut" },
    },
  },
  {
    id: "sauna",
    title: { fi: "Sauna", en: "Sauna" },
    match: "any",
    options: {
      electricSauna: { fi: "Sähkösauna", en: "Electric sauna" },
      smokeSauna: { fi: "Savusauna", en: "Smoke sauna" },
      woodSauna: { fi: "Puusauna", en: "Wood-heated sauna" },
    },
  },
  {
    id: "features",
    title: { fi: "Ominaisuudet", en: "Features" },
    match: "all",
    options: {
      nearSki: { fi: "Hiihtokeskuksen lähellä", en: "Near a ski resort" },
      internet: { fi: "Internetyhteys", en: "Internet" },
      dryingCabinet: { fi: "Kuivauskaappi", en: "Drying cabinet" },
      tumbleDryer: { fi: "Kuivausrumpu", en: "Tumble dryer" },
      jetty: { fi: "Laituri", en: "Jetty" },
      loft: { fi: "Parvi", en: "Sleeping loft" },
      hotTub: { fi: "Palju (kylpytynnyri)", en: "Wood-fired hot tub" },
      jacuzzi: { fi: "Poreamme", en: "Jacuzzi" },
      washingMachine: { fi: "Pyykinpesukone", en: "Washing machine" },
      highChair: { fi: "Syöttötuoli", en: "High chair" },
      shower: { fi: "Suihku", en: "Shower" },
      evCharging: { fi: "Sähköauton latausmahdollisuus", en: "EV charging" },
      fireplace: { fi: "Takka", en: "Fireplace" },
      tv: { fi: "Televisio", en: "TV" },
      pool: { fi: "Uima-allas", en: "Swimming pool" },
      outdoorJacuzzi: { fi: "Ulkoporeallas", en: "Outdoor jacuzzi" },
      babyBed: { fi: "Vauvasänky", en: "Baby cot" },
      noElectricity: { fi: "Mökissä ei sähköjä", en: "No electricity" },
      solarPower: { fi: "Sähkö aurinkopaneeleista", en: "Solar power" },
      carriedWater: { fi: "Kantovesi", en: "Water carried in" },
      heatPump: { fi: "Viilentävä ilmalämpöpumppu", en: "Heat pump with cooling" },
      indoorWc: { fi: "Sisä-WC", en: "Indoor toilet" },
      outdoorWc: { fi: "Ulko-WC", en: "Outdoor toilet" },
      boat: { fi: "Vene", en: "Rowing boat" },
      canoe: { fi: "Kanootti / kajakki", en: "Canoe / kayak" },
      pets: { fi: "Lemmikkieläimet sallittu", en: "Pets allowed" },
    },
  },
  {
    id: "accessibility",
    title: { fi: "Esteettömyys", en: "Accessibility" },
    match: "all",
    options: {
      wheelchair: { fi: "Pyörätuolisopivuus", en: "Wheelchair accessible" },
    },
  },
] as const satisfies readonly Group[];

type Groups = typeof FEATURE_GROUPS;
type OptionKeys<G> = G extends { options: infer O } ? keyof O & string : never;
export type FeatureKey = OptionKeys<Groups[number]>;
export type GroupId = Groups[number]["id"];

export const BEDROOM_CHOICES = [1, 2, 3, 4] as const; // 4 means 4 or more
