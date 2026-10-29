// Photos and example prices on the owner page. The words are in
// src/i18n/messages (owner.hero, owner.listings, owner.calendar, owner.form).

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

/** Photo and nightly price (euros) of each example card, in the order of owner.listings.cards. */
export const SHOWCASE_CARDS: { photo: keyof typeof PHOTOS; price: number }[] = [
  { photo: "card1", price: 140 },
  { photo: "card2", price: 120 },
  { photo: "card3", price: 190 },
  { photo: "card4", price: 160 },
];
