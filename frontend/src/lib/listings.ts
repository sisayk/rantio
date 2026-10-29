// Example cottages for the guest homepage until real owners are live.
// Photos: Unsplash (Unsplash License), served from Unsplash's image CDN.

export const unsplash = (id: string, w: number, h: number, crop = "entropy") =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&${
    crop === "center" ? "crop=focalpoint&fp-x=0.5&fp-y=0.5" : `crop=${crop}`
  }&auto=format&q=75`;

export const HERO_PHOTO = unsplash("1698701680003-5272b37f57c0", 2000, 900);

// Nordic and Baltic countries Stugora covers, in the order shown to guests.
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

export const AMENITIES = ["sauna", "lake", "fireplace", "wifi", "hotTub"] as const;
export type Amenity = (typeof AMENITIES)[number];

export const CHANNELS = ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"] as const;

export type Listing = {
  id: string;
  photo: string;
  photoCrop?: "top" | "bottom" | "center" | "entropy";
  name: { fi: string; en: string };
  place: string; // town and area; the country name is added when shown
  country: Country;
  guests: number;
  bedrooms: number;
  price: number; // EUR per night
  badge: Exclude<Category, "all">;
  categories: Exclude<Category, "all">[];
  amenities: Amenity[];
  instantBook: boolean;
  freeCancellation: boolean;
  channels: (typeof CHANNELS)[number][];
  rating?: number; // only real review averages, never invented
};

const INTERNATIONAL: Listing["channels"] = ["Airbnb", "Booking.com", "Vrbo"];
const FINLAND_ALL: Listing["channels"] = ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"];

export const LISTINGS: Listing[] = [
  {
    id: "lakeside-villa",
    photo: "1574514342513-f739e07c81cf",
    name: { fi: "Järvihuvila", en: "Lakeside Villa" },
    place: "Savonlinna, Saimaa",
    country: "FI",
    guests: 6,
    bedrooms: 3,
    price: 180,
    badge: "waterfront",
    categories: ["waterfront", "sauna", "family"],
    amenities: ["sauna", "lake", "wifi", "hotTub"],
    instantBook: true,
    freeCancellation: true,
    channels: FINLAND_ALL,
  },
  {
    id: "lofoten-rorbu",
    photo: "1696229720367-db510940a3f5",
    photoCrop: "center",
    name: { fi: "Kalastajamökki Lofooteilla", en: "Lofoten Fisherman's Cabin" },
    place: "Reine, Lofoten",
    country: "NO",
    guests: 4,
    bedrooms: 2,
    price: 210,
    badge: "waterfront",
    categories: ["waterfront", "unique", "aurora", "traditional"],
    amenities: ["lake", "wifi"],
    instantBook: true,
    freeCancellation: false,
    channels: INTERNATIONAL,
  },
  {
    id: "red-stuga",
    photo: "1617645861462-855c6660550b",
    name: { fi: "Punainen torppa", en: "Red Stuga" },
    place: "Växjö, Småland",
    country: "SE",
    guests: 5,
    bedrooms: 2,
    price: 130,
    badge: "traditional",
    categories: ["traditional", "forest", "pets", "family"],
    amenities: ["fireplace", "wifi"],
    instantBook: false,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "arctic-cabin",
    photo: "1643611657752-fb0ce6989d88",
    name: { fi: "Revontulimökki", en: "Arctic Cabin" },
    place: "Levi, Lapland",
    country: "FI",
    guests: 4,
    bedrooms: 2,
    price: 190,
    badge: "aurora",
    categories: ["aurora", "skiing", "sauna", "unique"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: true,
    freeCancellation: true,
    channels: FINLAND_ALL,
  },
  {
    id: "dune-cabin",
    photo: "1786194152334-3e86d8287063",
    photoCrop: "center",
    name: { fi: "Dyynimökki", en: "Dune Summer House" },
    place: "Henne Strand, Jutland",
    country: "DK",
    guests: 6,
    bedrooms: 3,
    price: 160,
    badge: "family",
    categories: ["family", "waterfront", "pets"],
    amenities: ["wifi", "hotTub"],
    instantBook: true,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "fjord-house",
    photo: "1661279188780-2e2d2f749840",
    photoCrop: "center",
    name: { fi: "Vuonotalo", en: "Fjord House" },
    place: "Ísafjörður, Westfjords",
    country: "IS",
    guests: 4,
    bedrooms: 2,
    price: 240,
    badge: "unique",
    categories: ["unique", "waterfront", "aurora"],
    amenities: ["lake", "wifi"],
    instantBook: false,
    freeCancellation: false,
    channels: INTERNATIONAL,
  },
  {
    id: "modern-forest-retreat",
    photo: "1724931282671-2d3bcd6de8f2",
    name: { fi: "Moderni metsähuvila", en: "Modern Forest Retreat" },
    place: "Jämsä, Central Finland",
    country: "FI",
    guests: 6,
    bedrooms: 3,
    price: 175,
    badge: "sauna",
    categories: ["modern", "forest", "sauna"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: true,
    freeCancellation: false,
    channels: FINLAND_ALL,
  },
  {
    id: "ivy-cottage",
    photo: "1596962727337-3f800f290de1",
    name: { fi: "Muratimökki", en: "Ivy Cottage" },
    place: "Kuressaare, Saaremaa",
    country: "EE",
    guests: 4,
    bedrooms: 2,
    price: 95,
    badge: "traditional",
    categories: ["traditional", "sauna", "pets"],
    amenities: ["sauna", "wifi"],
    instantBook: true,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "fjord-cabin",
    photo: "1565450443120-ea90b0ca5117",
    photoCrop: "center",
    name: { fi: "Vuonomökki", en: "Fjord Cabin" },
    place: "Ulvik, Hardanger",
    country: "NO",
    guests: 5,
    bedrooms: 2,
    price: 185,
    badge: "waterfront",
    categories: ["waterfront", "traditional", "family"],
    amenities: ["lake", "fireplace"],
    instantBook: false,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "lake-house-latgale",
    photo: "1700228509432-519ed2d2d754",
    name: { fi: "Järvitalo", en: "Lake House" },
    place: "Rēzekne, Latgale",
    country: "LV",
    guests: 6,
    bedrooms: 3,
    price: 90,
    badge: "sauna",
    categories: ["sauna", "waterfront", "forest", "family"],
    amenities: ["sauna", "lake", "hotTub"],
    instantBook: false,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "ski-stuga",
    photo: "1632217367356-8d948d7c7e7e",
    name: { fi: "Hiihtomökki", en: "Ski Stuga" },
    place: "Åre, Jämtland",
    country: "SE",
    guests: 8,
    bedrooms: 4,
    price: 220,
    badge: "skiing",
    categories: ["skiing", "family", "sauna", "forest"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: true,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
  {
    id: "thatched-homestead",
    photo: "1723987731572-795df078bfcd",
    name: { fi: "Olkikattoinen maatila", en: "Thatched Homestead" },
    place: "Nida, Curonian Spit",
    country: "LT",
    guests: 8,
    bedrooms: 4,
    price: 120,
    badge: "traditional",
    categories: ["traditional", "family", "pets", "unique"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: false,
    freeCancellation: true,
    channels: INTERNATIONAL,
  },
];
