import type { Lang } from "../locales";

/** The top of a cottage's page, as in Airbnb's: rating · Guest favourite · reviews, and who hosts.
 *  Only real data (backend/owners/reviews.py CottageAboutView). Guest favourite is Rantio's own:
 *  an average of 4.8 or more from at least five reviews by guests who stayed through Rantio. */
export type HighlightsText = {
  guestFavourite: string;
  favouriteLead: string;
  hostedBy: string;
  hostingSince: string;
};

export const HIGHLIGHTS: Record<Lang, HighlightsText> = {
  en: { guestFavourite: "Guest favourite", favouriteLead: "Among the best-rated cottages on Rantio", hostedBy: "Hosted by {name}", hostingSince: "Hosting on Rantio since {year}" },
  fi: { guestFavourite: "Vieraiden suosikki", favouriteLead: "Rantion parhaiten arvioituja mökkejä", hostedBy: "Vuokraaja {name}", hostingSince: "Vuokrannut Rantiossa vuodesta {year}" },
  sv: { guestFavourite: "Gästfavorit", favouriteLead: "Bland de bäst betygsatta stugorna på Rantio", hostedBy: "Värd: {name}", hostingSince: "Värd på Rantio sedan {year}" },
  nb: { guestFavourite: "Gjestefavoritt", favouriteLead: "Blant de best vurderte hyttene på Rantio", hostedBy: "Vert: {name}", hostingSince: "Vert på Rantio siden {year}" },
  nn: { guestFavourite: "Gjestefavoritt", favouriteLead: "Mellom dei best vurderte hyttene på Rantio", hostedBy: "Vert: {name}", hostingSince: "Vert på Rantio sidan {year}" },
  da: { guestFavourite: "Gæstefavorit", favouriteLead: "Blandt de bedst bedømte sommerhuse på Rantio", hostedBy: "Vært: {name}", hostingSince: "Vært på Rantio siden {year}" },
  is: { guestFavourite: "Uppáhald gesta", favouriteLead: "Meðal best metnu sumarhúsanna á Rantio", hostedBy: "Gestgjafi: {name}", hostingSince: "Gestgjafi á Rantio síðan {year}" },
  et: { guestFavourite: "Külaliste lemmik", favouriteLead: "Rantio kõrgeima hinnanguga majade seas", hostedBy: "Võõrustaja: {name}", hostingSince: "Rantios võõrustaja aastast {year}" },
  lv: { guestFavourite: "Viesu favorīts", favouriteLead: "Starp augstāk novērtētajām Rantio mājiņām", hostedBy: "Saimnieks: {name}", hostingSince: "Rantio saimnieks kopš {year}" },
  lt: { guestFavourite: "Svečių mėgstamiausias", favouriteLead: "Tarp geriausiai įvertintų Rantio namelių", hostedBy: "Šeimininkas: {name}", hostingSince: "Rantio šeimininkas nuo {year}" },
  de: { guestFavourite: "Gästeliebling", favouriteLead: "Unter den bestbewerteten Ferienhäusern auf Rantio", hostedBy: "Gastgeber: {name}", hostingSince: "Gastgeber auf Rantio seit {year}" },
};
