import type { Lang } from "./content";

// Free photos from Unsplash (Unsplash License), served from Unsplash's image CDN.
// Swap for the pilot owners' own photos as soon as we have them.
const unsplash = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&crop=entropy&auto=format&q=75`;

export const PHOTOS = {
  hero: { src: unsplash("photo-1742639008233-6747489ba7a4", 1200, 1440) },
  card1: { src: unsplash("photo-1612778911868-2aa506429dea", 800, 800) },
  card2: { src: unsplash("photo-1749069262065-ed7f45b8153c", 800, 800) },
  card3: { src: unsplash("photo-1644753034211-46b88ca81132", 800, 800) },
  card4: { src: unsplash("photo-1629024794900-7ceb15e4e95e", 800, 800) },
  interior: { src: unsplash("photo-1561033318-78e75f096306", 1000, 1200) },
  winter: { src: unsplash("photo-1674973543867-b7c3864ca853", 1000, 1300) },
} as const;

type Card = { photo: keyof typeof PHOTOS; region: string; title: string; facts: string; price: string };

const fi = {
  heroAlt: "Mökki järven rannalla pilvisenä kesäpäivänä",
  chipBooking: { title: "Uusi varaus Airbnbsta", body: "12.–15.7., 2 vierasta Saksasta" },
  chipSync: "Samat päivät suljettu Nettimökistä",
  listings: {
    title: "Tältä mökkisi näyttää ulkomaisille vieraille",
    lead: "Teemme jokaiselle mökille ilmoituksen englanniksi isoilla kuvilla, selkeillä tiedoilla ja hinnalla, joka jättää sinulle vähintään saman kuin Nettimökissä.",
    note: "Esimerkkejä. Kuvat: Unsplash.",
    cards: [
      { photo: "card1", region: "Järvi-Suomi", title: "Punainen mökki ja iso piha", facts: "6 vierasta, 3 makuuhuonetta", price: "140 €" },
      { photo: "card2", region: "Saimaa", title: "Mökki keskellä mäntymetsää", facts: "4 vierasta, puusauna", price: "120 €" },
      { photo: "card3", region: "Lappi", title: "Punainen talvimökki", facts: "5 vierasta, takka ja sauna", price: "190 €" },
      { photo: "card4", region: "Saimaa", title: "Rantamökki ja oma laituri", facts: "6 vierasta, oma ranta", price: "160 €" },
    ] as Card[],
    perNight: "/ yö",
  },
  calendarAlt: "Keinutuoli mökin ikkunan ääressä",
  formAlt: "Hirsimökki lumisessa metsässä",
  formAside: {
    title: "Käymme mökin läpi yhdessä",
    body: "Soitamme tai tapaamme, ja teemme ilmoitukset valmiiksi puolestasi.",
  },
};

const en: typeof fi = {
  heroAlt: "A cottage on a lake shore on a cloudy summer day",
  chipBooking: { title: "New booking from Airbnb", body: "12–15 July, 2 guests from Germany" },
  chipSync: "Same dates closed on Nettimökki",
  listings: {
    title: "How your cottage looks to guests from abroad",
    lead: "We make every cottage an English listing with large photos, clear facts and a price that leaves you at least what you get on the sites you use now.",
    note: "Examples. Photos: Unsplash.",
    cards: [
      { photo: "card1", region: "Lakeland", title: "Red cottage with a big garden", facts: "6 guests, 3 bedrooms", price: "€140" },
      { photo: "card2", region: "Saimaa", title: "Cottage deep in a pine forest", facts: "4 guests, wood sauna", price: "€120" },
      { photo: "card3", region: "Lapland", title: "Red winter cottage", facts: "5 guests, fireplace and sauna", price: "€190" },
      { photo: "card4", region: "Saimaa", title: "Lakeside cottage with its own jetty", facts: "6 guests, private shore", price: "€160" },
    ],
    perNight: "/ night",
  },
  calendarAlt: "A rocking chair by a cottage window",
  formAlt: "A log cabin in a snowy forest",
  formAside: {
    title: "We go through your cottage together",
    body: "We call or meet you, then get the listings ready for you.",
  },
};

export const showcase: Record<Lang, typeof fi> = { fi, en };
