// Example cottages for the guest homepage until real owners are live.
import { type ChannelId, CHANNELS_BY_COUNTRY, type FeatureKey } from "./catalog";
import { COUNTRY_CURRENCY, type Currency } from "./currency";
// Photos: Unsplash (Unsplash License), served from Unsplash's image CDN.

export const unsplash = (id: string, w: number, h: number, crop = "entropy") =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&${
    crop === "center" ? "crop=focalpoint&fp-x=0.5&fp-y=0.5" : `crop=${crop}`
  }&auto=format&q=75`;

/** The whole photo at a width, not cropped (for the full-size photo viewer). */
export const unsplashWhole = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?w=${w}&auto=format&q=80`;

export const HERO_PHOTO = unsplash("1698701680003-5272b37f57c0", 2000, 900);

// Nordic and Baltic countries Rantio covers, in the order shown to guests.
export const COUNTRIES = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"] as const;
export type Country = (typeof COUNTRIES)[number];

export const CATEGORIES = [
  "all",
  "waterfront",
  "forest",
  "modern",
  "traditional",
  "sauna",
  "aurora",
  "skiing",
  "pets",
  "family",
  "unique",
] as const;
export type Category = (typeof CATEGORIES)[number];


export type Listing = {
  id: string;
  photo: string;
  photoCrop?: "top" | "bottom" | "center" | "entropy";
  /** More photos after the first: what each shows, and its Unsplash id (all Unsplash License). */
  gallery?: [PhotoKind, string][];
  // The name is in each language's messages (listingNames), keyed by id.
  place: string; // town and area; the country name is added when shown
  country: Country;
  region: string; // region id from places.ts
  city: string; // town name as in places.ts
  lat: number;
  lng: number;
  guests: number;
  bedrooms: number;
  price: number; // per night, in the country's currency (listingCurrency)
  badge: Exclude<Category, "all">;
  categories: Exclude<Category, "all">[];
  features: FeatureKey[];
  channels: ChannelId[];
  rating?: number; // only real review averages, never invented
};


export const LISTINGS: Listing[] = [
  {
    id: "lakeside-villa",
    photo: "1574514342513-f739e07c81cf",
    gallery: [["living", "1761319914911-71b059a655d8"], ["bedroom", "1773423391716-04e278b07b1b"], ["kitchen", "1761656630581-69a58e4e1c09"], ["sauna", "1786799901347-e45b3e2d64ea"], ["outside", "1610828754500-f7221acbf8c9"]],
    place: "Savonlinna, Saimaa",
    country: "FI",
    region: "etela-savo",
    city: "Savonlinna",
    lat: 61.842,
    lng: 28.965,
    guests: 6,
    bedrooms: 3,
    price: 180,
    badge: "waterfront",
    categories: ["waterfront", "sauna", "family"],
    features: ["instantBook", "freeCancellation", "lake", "privateShore", "electricSauna", "woodSauna", "jetty", "boat", "canoe", "hotTub", "dishwasher", "washingMachine", "grillHut", "highChair", "babyBed", "heatPump", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "lofoten-rorbu",
    photo: "1696229720367-db510940a3f5",
    photoCrop: "center",
    gallery: [["living", "1631630259742-c0f0b17c6c10"], ["bedroom", "1705372334341-3780ebb7c97b"], ["kitchen", "1786894388631-caddf54fd38b"], ["outside", "1508592931388-95bc7b61033d"], ["outside", "1554140781-33058d9962b9"]],
    place: "Reine, Lofoten",
    country: "NO",
    region: "nordland",
    city: "Reine",
    lat: 67.933,
    lng: 13.088,
    guests: 4,
    bedrooms: 2,
    price: 3200,
    badge: "waterfront",
    categories: ["waterfront", "unique", "aurora", "traditional"],
    features: ["instantBook", "sea", "sharedShore", "waterAccess", "boat", "fireplace", "loft", "dryingCabinet", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.NO,
  },
  {
    id: "red-stuga",
    photo: "1617645861462-855c6660550b",
    gallery: [["living", "1680703486830-1b5af60635d7"], ["bedroom", "1631805991633-eb01749753af"], ["kitchen", "1761662826410-3218852da3bf"], ["sauna", "1717356495389-6ab1e5ff9d84"], ["outside", "1719782056499-bdf422e1ef83"]],
    place: "Växjö, Småland",
    country: "SE",
    region: "kronoberg",
    city: "Växjö",
    lat: 56.835,
    lng: 14.735,
    guests: 5,
    bedrooms: 2,
    price: 1450,
    badge: "traditional",
    categories: ["traditional", "forest", "pets", "family"],
    features: ["freeCancellation", "pets", "fireplace", "loft", "grillHut", "outdoorWc", "indoorWc", "shower", "fridge", "stove", "oven", "cooking", "coffeeMaker"],
    channels: CHANNELS_BY_COUNTRY.SE,
  },
  {
    id: "arctic-cabin",
    photo: "1643611657752-fb0ce6989d88",
    gallery: [["living", "1773579089983-50348cc9abd0"], ["bedroom", "1699629208190-672f7ef56d7b"], ["sauna", "1660735698223-23a4edefa264"], ["outside", "1741948924635-13a7ddbc6a05"], ["outside", "1638985787285-46f05ff063f2"]],
    place: "Levi, Lapland",
    country: "FI",
    region: "lappi",
    city: "Levi",
    lat: 67.79,
    lng: 24.835,
    guests: 4,
    bedrooms: 2,
    price: 420,
    badge: "aurora",
    categories: ["aurora", "skiing", "sauna", "unique"],
    features: ["instantBook", "freeCancellation", "woodSauna", "nearSki", "fireplace", "dryingCabinet", "washingMachine", "tumbleDryer", "evCharging", "outdoorJacuzzi", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "dune-cabin",
    photo: "1786194152334-3e86d8287063",
    photoCrop: "center",
    gallery: [["living", "1591825729269-caeb344f6df2"], ["bedroom", "1734599511415-cb4a52aea2fe"], ["kitchen", "1672710111844-28bd94487641"], ["outside", "1662232203426-ee09650f4c27"], ["outside", "1694434058751-8008d1fa3d86"]],
    place: "Henne Strand, Jutland",
    country: "DK",
    region: "syddanmark",
    city: "Henne Strand",
    lat: 55.733,
    lng: 8.195,
    guests: 6,
    bedrooms: 3,
    price: 1200,
    badge: "family",
    categories: ["family", "waterfront", "pets"],
    features: ["instantBook", "freeCancellation", "sea", "shoreAccess", "pets", "hotTub", "dishwasher", "washingMachine", "highChair", "babyBed", "heatPump", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.DK,
  },
  {
    id: "fjord-house",
    photo: "1661279188780-2e2d2f749840",
    photoCrop: "center",
    gallery: [["living", "1721714808874-35bcb03a8277"], ["bedroom", "1734599505058-6653a0d8d3ff"], ["kitchen", "1658893947482-41c55d565163"], ["outside", "1495072667656-424d680e6299"], ["outside", "1673219498962-26df0c20dd97"]],
    place: "Ísafjörður, Westfjords",
    country: "IS",
    region: "vestfirdir",
    city: "Ísafjörður",
    lat: 66.062,
    lng: -23.16,
    guests: 4,
    bedrooms: 2,
    price: 52000,
    badge: "unique",
    categories: ["unique", "waterfront", "aurora"],
    features: ["sea", "shoreAccess", "fireplace", "jacuzzi", "dryingCabinet", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.IS,
  },
  {
    id: "modern-forest-retreat",
    photo: "1724931282671-2d3bcd6de8f2",
    gallery: [["living", "1761782791727-3994283faa88"], ["bedroom", "1727706572437-4fcda0cbd66f"], ["kitchen", "1776950815445-f80f2b21fa50"], ["sauna", "1757940661240-f2e8d2ff93bf"], ["outside", "1785245647119-ccd4bc406fa2"]],
    place: "Jämsä, Central Finland",
    country: "FI",
    region: "keski-suomi",
    city: "Jämsä",
    lat: 61.883,
    lng: 25.06,
    guests: 6,
    bedrooms: 3,
    price: 175,
    badge: "sauna",
    categories: ["modern", "forest", "sauna"],
    features: ["instantBook", "electricSauna", "fireplace", "dishwasher", "washingMachine", "tumbleDryer", "evCharging", "jacuzzi", "heatPump", "nearSki", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "ivy-cottage",
    photo: "1596962727337-3f800f290de1",
    gallery: [["living", "1631941392209-70cad44ecfb7"], ["bedroom", "1550514704-91c29ba3442a"], ["kitchen", "1787755144917-cbcf31e44f26"], ["outside", "1786478537433-b2713be1f91c"]],
    place: "Kuressaare, Saaremaa",
    country: "EE",
    region: "saaremaa",
    city: "Kuressaare",
    lat: 58.27,
    lng: 22.46,
    guests: 4,
    bedrooms: 2,
    price: 95,
    badge: "traditional",
    categories: ["traditional", "sauna", "pets"],
    features: ["instantBook", "freeCancellation", "sea", "shoreAccess", "woodSauna", "pets", "grillHut", "indoorWc", "shower", "internet", "fridge", "stove", "oven", "cooking", "coffeeMaker"],
    channels: CHANNELS_BY_COUNTRY.EE,
  },
  {
    id: "fjord-cabin",
    photo: "1565450443120-ea90b0ca5117",
    photoCrop: "center",
    gallery: [["living", "1696860740793-1bb7bf33cdc1"], ["kitchen", "1697807713040-b5fb60d6f012"], ["sauna", "1712659604528-b179a3634560"], ["outside", "1504233529578-6d46baba6d34"]],
    place: "Ulvik, Hardanger",
    country: "NO",
    region: "vestland",
    city: "Ulvik",
    lat: 60.562,
    lng: 6.93,
    guests: 5,
    bedrooms: 2,
    price: 1900,
    badge: "waterfront",
    categories: ["waterfront", "traditional", "family"],
    features: ["freeCancellation", "sea", "privateShore", "jetty", "boat", "canoe", "fireplace", "highChair", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.NO,
  },
  {
    id: "lake-house-latgale",
    photo: "1700228509432-519ed2d2d754",
    gallery: [["living", "1645242075656-e4e435b7a5f5"], ["kitchen", "1716408717774-2707347345c7"], ["outside", "1597686512950-fd9e47e920b1"], ["outside", "1653760253102-e50369ee652c"]],
    place: "Rēzekne, Latgale",
    country: "LV",
    region: "latgale",
    city: "Rēzekne",
    lat: 56.33,
    lng: 27.48,
    guests: 6,
    bedrooms: 3,
    price: 90,
    badge: "sauna",
    categories: ["sauna", "waterfront", "forest", "family"],
    features: ["freeCancellation", "lake", "privateShore", "woodSauna", "smokeSauna", "jetty", "boat", "hotTub", "grillHut", "highChair", "babyBed", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet"],
    channels: CHANNELS_BY_COUNTRY.LV,
  },
  {
    id: "ski-stuga",
    photo: "1632217367356-8d948d7c7e7e",
    gallery: [["bedroom", "1734599505101-66d53bd36927"], ["sauna", "1757940556610-a114be4733bf"], ["outside", "1511489731872-324afc650052"], ["outside", "1577457943926-11193adc0563"], ["outside", "1510798831971-661eb04b3739"]],
    place: "Åre, Jämtland",
    country: "SE",
    region: "jamtland",
    city: "Åre",
    lat: 63.403,
    lng: 13.05,
    guests: 8,
    bedrooms: 4,
    price: 5750,
    badge: "skiing",
    categories: ["skiing", "family", "sauna", "forest"],
    features: ["instantBook", "freeCancellation", "electricSauna", "nearSki", "fireplace", "dryingCabinet", "washingMachine", "tumbleDryer", "dishwasher", "highChair", "babyBed", "evCharging", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.SE,
  },
  {
    id: "thatched-homestead",
    photo: "1723987731572-795df078bfcd",
    gallery: [["outside", "1792782418351-77a679ef408b"], ["outside", "1694434047289-01a2b4b29f30"], ["outside", "1630573577896-04e7c5b7fe33"]],
    place: "Nida, Curonian Spit",
    country: "LT",
    region: "klaipeda",
    city: "Nida",
    lat: 55.305,
    lng: 21.005,
    guests: 8,
    bedrooms: 4,
    price: 120,
    badge: "traditional",
    categories: ["traditional", "family", "pets", "unique"],
    features: ["freeCancellation", "sea", "shoreAccess", "woodSauna", "pets", "fireplace", "grillHut", "highChair", "babyBed", "wheelchair", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.LT,
  },
  {
    id: "archipelago-villa",
    photo: "1705840337565-630edbc57b24",
    gallery: [["living", "1721714808874-35bcb03a8277"], ["outside", "1762857995839-62cf8587f542"], ["sauna", "1786799966417-bead801334e7"], ["outside", "1601913528633-c158d4736628"]],
    place: "Porvoo, Uusimaa",
    country: "FI",
    region: "uusimaa",
    city: "Porvoo",
    lat: 60.3150,
    lng: 25.7350,
    guests: 6,
    bedrooms: 3,
    price: 950,
    badge: "waterfront",
    categories: ["waterfront", "sauna", "family"],
    features: ["instantBook", "freeCancellation", "sea", "privateShore", "jetty", "boat", "canoe", "woodSauna", "electricSauna", "dishwasher", "washingMachine", "highChair", "babyBed", "heatPump", "wheelchair", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "lohja-lake-cabin",
    photo: "1687614706800-22f780f2cb11",
    gallery: [["outside", "1781871226730-0a856186a513"], ["sauna", "1678988227223-45112511eca2"], ["outside", "1643779161320-188301d04df6"], ["outside", "1629024794900-7ceb15e4e95e"]],
    place: "Lohja, Uusimaa",
    country: "FI",
    region: "uusimaa",
    city: "Lohja",
    lat: 60.2230,
    lng: 23.9800,
    guests: 4,
    bedrooms: 2,
    price: 135,
    badge: "sauna",
    categories: ["sauna", "waterfront", "forest", "traditional"],
    features: ["freeCancellation", "lake", "privateShore", "woodSauna", "jetty", "boat", "loft", "outdoorWc", "solarPower", "carriedWater", "fridge", "stove", "cooking", "coffeeMaker", "grillHut"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "nuuksio-forest-cabin",
    photo: "1568729937315-2ef5ee9cf4f2",
    gallery: [["living", "1631630259742-c0f0b17c6c10"], ["bedroom", "1734599511415-cb4a52aea2fe"], ["sauna", "1757940556610-a114be4733bf"], ["outside", "1781871226730-0a856186a513"]],
    place: "Espoo, Uusimaa",
    country: "FI",
    region: "uusimaa",
    city: "Espoo",
    lat: 60.3080,
    lng: 24.5200,
    guests: 4,
    bedrooms: 2,
    price: 150,
    badge: "forest",
    categories: ["forest", "sauna", "pets"],
    features: ["instantBook", "freeCancellation", "pond", "shoreAccess", "woodSauna", "pets", "fireplace", "canoe", "dryingCabinet", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
  {
    id: "sipoo-seaside-cottage",
    photo: "1630832057884-966e56438ad4",
    gallery: [["living", "1591825729269-caeb344f6df2"], ["bedroom", "1550514704-91c29ba3442a"], ["kitchen", "1672710111844-28bd94487641"], ["outside", "1683921578464-c566b64742f3"]],
    place: "Sipoo, Uusimaa",
    country: "FI",
    region: "uusimaa",
    city: "Sipoo",
    lat: 60.2400,
    lng: 25.4300,
    guests: 5,
    bedrooms: 2,
    price: 170,
    badge: "waterfront",
    categories: ["waterfront", "traditional", "family"],
    features: ["freeCancellation", "sea", "privateShore", "jetty", "boat", "canoe", "woodSauna", "highChair", "grillHut", "heatPump", "fridge", "freezer", "stove", "oven", "cooking", "coffeeMaker", "microwave", "indoorWc", "shower", "internet", "tv"],
    channels: CHANNELS_BY_COUNTRY.FI,
  },
];

/** A cottage is priced in its own country's currency: kronor in Sweden, euros in Finland. */
export const listingCurrency = (l: { country: Country }): Currency => COUNTRY_CURRENCY[l.country] ?? "EUR";

export type PhotoKind = "exterior" | "living" | "bedroom" | "kitchen" | "sauna" | "outside";
export type ListingPhoto = { id: string; kind: PhotoKind; crop?: Listing["photoCrop"] };

/** The cottage's photos, the main one first. */
export const listingPhotos = (l: Listing): ListingPhoto[] => [
  { id: l.photo, kind: "exterior", crop: l.photoCrop },
  ...(l.gallery ?? []).map(([kind, id]) => ({ id, kind })),
];

export const getListing = (id: string) => LISTINGS.find((l) => l.id === id);

/** The cottage's name in the page's language, else its English name, else its id. */
export const listingName = (names: Record<string, string>, l: { id: string }) => names[l.id] ?? l.id;
