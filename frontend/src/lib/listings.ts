// Example cottages for the guest homepage until real owners are live.
// Photos: Unsplash (Unsplash License), served from Unsplash's image CDN.

export const unsplash = (id: string, w: number, h: number, crop = "entropy") =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&crop=${crop}&auto=format&q=75`;

export const HERO_PHOTO = unsplash("1698701680003-5272b37f57c0", 2000, 900);

export const CATEGORIES = [
  "all",
  "lakefront",
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
  photoCrop?: "top" | "bottom" | "entropy";
  name: { fi: string; en: string };
  place: string;
  region: "saimaa" | "lakeland" | "lapland";
  guests: number;
  bedrooms: number;
  price: number;
  badge: Exclude<Category, "all">;
  categories: Exclude<Category, "all">[];
  amenities: Amenity[];
  instantBook: boolean;
  freeCancellation: boolean;
  channels: (typeof CHANNELS)[number][];
  rating?: number; // only real review averages, never invented
};

export const LISTINGS: Listing[] = [
  {
    id: "lakeside-villa",
    photo: "1574514342513-f739e07c81cf",
    name: { fi: "Järvihuvila", en: "Lakeside Villa" },
    place: "Savonlinna, Saimaa",
    region: "saimaa",
    guests: 6,
    bedrooms: 3,
    price: 180,
    badge: "lakefront",
    categories: ["lakefront", "sauna", "modern"],
    amenities: ["sauna", "lake", "wifi", "hotTub"],
    instantBook: true,
    freeCancellation: true,
    channels: ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"],
  },
  {
    id: "forest-cabin",
    photo: "1630832057884-966e56438ad4",
    name: { fi: "Metsämökki laiturilla", en: "Forest Cabin" },
    place: "Puumala, Saimaa",
    region: "saimaa",
    guests: 4,
    bedrooms: 2,
    price: 140,
    badge: "lakefront",
    categories: ["lakefront", "forest", "traditional", "sauna"],
    amenities: ["sauna", "lake"],
    instantBook: false,
    freeCancellation: true,
    channels: ["Airbnb", "Booking.com", "Nettimökki"],
  },
  {
    id: "modern-forest-retreat",
    photo: "1724931282671-2d3bcd6de8f2",
    name: { fi: "Moderni metsähuvila", en: "Modern Forest Retreat" },
    place: "Jämsä",
    region: "lakeland",
    guests: 6,
    bedrooms: 3,
    price: 175,
    badge: "sauna",
    categories: ["modern", "forest", "sauna", "unique"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: true,
    freeCancellation: false,
    channels: ["Airbnb", "Booking.com", "Vrbo"],
  },
  {
    id: "arctic-cabin",
    photo: "1643611657752-fb0ce6989d88",
    name: { fi: "Revontulimökki", en: "Arctic Cabin" },
    place: "Levi, Lappi",
    region: "lapland",
    guests: 4,
    bedrooms: 2,
    price: 190,
    badge: "aurora",
    categories: ["aurora", "skiing", "sauna", "unique"],
    amenities: ["sauna", "fireplace", "wifi"],
    instantBook: true,
    freeCancellation: true,
    channels: ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"],
  },
  {
    id: "family-cottage",
    photo: "1687191601915-f7fb779fb9bf",
    name: { fi: "Perhemökki rannalla", en: "Family Cottage" },
    place: "Mikkeli, Saimaa",
    region: "saimaa",
    guests: 8,
    bedrooms: 4,
    price: 160,
    badge: "family",
    categories: ["family", "lakefront", "forest", "sauna"],
    amenities: ["sauna", "lake", "wifi"],
    instantBook: false,
    freeCancellation: true,
    channels: ["Airbnb", "Booking.com", "Nettimökki"],
  },
  {
    id: "holiday-home",
    photo: "1568729937315-2ef5ee9cf4f2",
    name: { fi: "Lomakoti metsän reunalla", en: "Holiday Home" },
    place: "Rovaniemi, Lappi",
    region: "lapland",
    guests: 6,
    bedrooms: 3,
    price: 170,
    badge: "pets",
    categories: ["pets", "forest", "family", "sauna"],
    amenities: ["sauna", "fireplace"],
    instantBook: true,
    freeCancellation: false,
    channels: ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"],
  },
  {
    id: "traditional-cottage",
    photo: "1612778911868-2aa506429dea",
    photoCrop: "top",
    name: { fi: "Perinteinen punainen mökki", en: "Traditional Cottage" },
    place: "Päijänne",
    region: "lakeland",
    guests: 5,
    bedrooms: 3,
    price: 150,
    badge: "traditional",
    categories: ["traditional", "family", "pets", "sauna"],
    amenities: ["sauna", "lake"],
    instantBook: false,
    freeCancellation: true,
    channels: ["Airbnb", "Nettimökki"],
  },
  {
    id: "ski-chalet",
    photo: "1610803523148-a0052fa341bb",
    name: { fi: "Rinnehuvila", en: "Ski Chalet" },
    place: "Ylläs, Lappi",
    region: "lapland",
    guests: 8,
    bedrooms: 4,
    price: 220,
    badge: "skiing",
    categories: ["skiing", "family", "sauna", "modern"],
    amenities: ["sauna", "fireplace", "wifi", "hotTub"],
    instantBook: true,
    freeCancellation: true,
    channels: ["Airbnb", "Booking.com", "Vrbo", "Nettimökki"],
  },
];
