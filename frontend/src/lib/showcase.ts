import type { Lang } from "./content";

// Free photos from Unsplash (Unsplash License), stored in /public/photos.
// Swap for the pilot owners' own photos as soon as we have them.
export const PHOTOS = {
  hero: { src: "/photos/hero-lake-cabin.jpg", unsplash: "photo-1742639008233-6747489ba7a4" },
  card1: { src: "/photos/card-red-house.jpg", unsplash: "photo-1612778911868-2aa506429dea" },
  card2: { src: "/photos/card-forest-cabin.jpg", unsplash: "photo-1749069262065-ed7f45b8153c" },
  card3: { src: "/photos/card-snow-cabin.jpg", unsplash: "photo-1644753034211-46b88ca81132" },
  card4: { src: "/photos/card-lake-sunset.jpg", unsplash: "photo-1742639008187-0294cf3fdf93" },
  interior: { src: "/photos/interior-rocking-chair.jpg", unsplash: "photo-1561033318-78e75f096306" },
  winter: { src: "/photos/winter-log-cabin.jpg", unsplash: "photo-1674973543867-b7c3864ca853" },
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
      { photo: "card1", region: "Järvi-Suomi", title: "Punainen mökki ja pihasauna", facts: "6 vierasta, 3 makuuhuonetta", price: "140 €" },
      { photo: "card2", region: "Saimaa", title: "Hirsimökki metsän laidalla", facts: "4 vierasta, puusauna", price: "120 €" },
      { photo: "card3", region: "Lappi", title: "Talvimökki tunturin juurella", facts: "5 vierasta, takka ja sauna", price: "190 €" },
      { photo: "card4", region: "Saimaa", title: "Rantamökki ja oma laituri", facts: "6 vierasta, järvinäkymä", price: "160 €" },
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
    lead: "We make every cottage an English listing with large photos, clear facts and a price that leaves you at least what you get on Nettimökki.",
    note: "Examples. Photos: Unsplash.",
    cards: [
      { photo: "card1", region: "Lakeland", title: "Red cottage with a garden sauna", facts: "6 guests, 3 bedrooms", price: "€140" },
      { photo: "card2", region: "Saimaa", title: "Log cabin at the forest edge", facts: "4 guests, wood sauna", price: "€120" },
      { photo: "card3", region: "Lapland", title: "Winter cabin below the fells", facts: "5 guests, fireplace and sauna", price: "€190" },
      { photo: "card4", region: "Saimaa", title: "Lakeside cottage with its own jetty", facts: "6 guests, lake view", price: "€160" },
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
