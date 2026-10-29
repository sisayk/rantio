// What guests can do at and around a cottage, worked out from the cottage's own
// details (shore, sauna, boat, ski area, ...) and its country. Nothing here is
// invented per cottage: an activity shows only when the listing's data supports it.
import type { Lang } from "./content";
import type { Country, Listing } from "./listings";

export type Season = "summer" | "winter" | "autumn" | "darkSeason" | "allYear";

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

type Text = Record<Lang, string>;
type Activity = { id: ActivityId; season: Season; title: Text; body: (l: Listing, lang: Lang) => string };

const has = (l: Listing, ...keys: string[]) => keys.some((k) => (l.features as string[]).includes(k));
const cat = (l: Listing, c: string) => (l.categories as string[]).includes(c);

// Everyman's right (jokamiehenoikeus / allemansrätten / allemannsretten) lets anyone
// pick wild berries and mushrooms in these countries.
const FORAGING_COUNTRIES: Country[] = ["FI", "SE", "NO", "EE"];
// Sandy sea beaches are the draw on these coasts.
const BEACH_COUNTRIES: Country[] = ["DK", "LT", "EE"];
// Lakes here normally freeze over in winter.
const ICE_COUNTRIES: Country[] = ["FI", "SE", "NO", "EE", "LV", "LT"];

const water = (l: Listing, lang: Lang) => {
  const fi = has(l, "lake") ? "järveen" : has(l, "sea") ? "mereen" : has(l, "river") ? "jokeen" : "lampeen";
  const en = has(l, "lake") ? "lake" : has(l, "sea") ? "sea" : has(l, "river") ? "river" : "pond";
  return lang === "fi" ? fi : en;
};

const RULES: { activity: Activity; when: (l: Listing) => boolean }[] = [
  {
    when: (l) => has(l, "lake", "river", "pond") || (has(l, "sea") && !BEACH_COUNTRIES.includes(l.country)),
    activity: {
      id: "swim",
      season: "summer",
      title: { fi: "Uiminen", en: "Swimming" },
      body: (l, lang) =>
        has(l, "privateShore")
          ? lang === "fi" ? `Pulahdus ${water(l, lang)} suoraan mökin omalta rannalta.` : `Straight into the ${water(l, lang)} from the cottage's own shore.`
          : lang === "fi" ? `Uimaan ${water(l, lang)} lyhyen kävelyn päähän.` : `A short walk to swim in the ${water(l, lang)}.`,
    },
  },
  {
    when: (l) => has(l, "sea") && BEACH_COUNTRIES.includes(l.country),
    activity: {
      id: "beach",
      season: "summer",
      title: { fi: "Rantapäivät", en: "Beach days" },
      body: (_l, lang) => (lang === "fi" ? "Hiekkarantaa, dyynejä ja auringonlaskuja meren äärellä." : "Sandy shores, dunes and sunsets over the sea."),
    },
  },
  {
    when: (l) => has(l, "electricSauna", "woodSauna", "smokeSauna"),
    activity: {
      id: "sauna",
      season: "allYear",
      title: { fi: "Sauna ja vilvoittelu", en: "Sauna and a cool-off" },
      body: (l, lang) => {
        const kind = has(l, "smokeSauna")
          ? lang === "fi" ? "Savusauna" : "A smoke sauna"
          : has(l, "woodSauna")
            ? lang === "fi" ? "Puulämmitteinen sauna" : "A wood-heated sauna"
            : lang === "fi" ? "Sähkösauna" : "An electric sauna";
        const after = has(l, "lake", "sea", "river", "pond")
          ? lang === "fi" ? `, ja vilvoittelemaan ${water(l, lang)}.` : `, then a dip in the ${water(l, lang)}.`
          : lang === "fi" ? " mökillä." : " at the cottage.";
        return kind + after;
      },
    },
  },
  {
    when: (l) => has(l, "boat"),
    activity: {
      id: "rowing",
      season: "summer",
      title: { fi: "Soutelu", en: "Rowing" },
      body: (_l, lang) => (lang === "fi" ? "Mökin veneellä saariin ja lahdenpoukamiin." : "Take the cottage's boat out to islands and quiet bays."),
    },
  },
  {
    when: (l) => has(l, "canoe"),
    activity: {
      id: "paddling",
      season: "summer",
      title: { fi: "Melonta", en: "Canoeing and kayaking" },
      body: (_l, lang) => (lang === "fi" ? "Kanootti tai kajakki kuuluu mökkiin." : "A canoe or kayak comes with the cottage."),
    },
  },
  {
    when: (l) => has(l, "lake", "sea", "river") && has(l, "boat", "jetty", "privateShore"),
    activity: {
      id: "fishing",
      season: "summer",
      title: { fi: "Kalastus", en: "Fishing" },
      body: (_l, lang) =>
        lang === "fi" ? "Onki laiturilta tai veneestä. Tarkista paikalliset kalastusluvat." : "Cast from the jetty or the boat. Check the local fishing permit rules.",
    },
  },
  {
    when: (l) => has(l, "lake") && ICE_COUNTRIES.includes(l.country),
    activity: {
      id: "iceFishing",
      season: "winter",
      title: { fi: "Pilkkiminen", en: "Ice fishing" },
      body: (_l, lang) => (lang === "fi" ? "Pilkille jäälle, kun jää on turvallisen paksua." : "Out on the frozen lake once the ice is safely thick."),
    },
  },
  {
    when: (l) => cat(l, "forest") || cat(l, "aurora") || cat(l, "skiing"),
    activity: {
      id: "hiking",
      season: "allYear",
      title: { fi: "Retkeily ja luontopolut", en: "Hiking and nature trails" },
      body: (_l, lang) => (lang === "fi" ? "Polkuja ja luontoa heti mökin ympärillä." : "Trails and wild nature right around the cottage."),
    },
  },
  {
    when: (l) => cat(l, "forest") && FORAGING_COUNTRIES.includes(l.country),
    activity: {
      id: "foraging",
      season: "autumn",
      title: { fi: "Marjastus ja sienestys", en: "Berry and mushroom picking" },
      body: (_l, lang) =>
        lang === "fi"
          ? "Jokamiehenoikeudella saa poimia metsän marjoja ja sieniä."
          : "Everyman's right lets anyone pick wild berries and mushrooms in the forest.",
    },
  },
  {
    when: (l) => has(l, "nearSki"),
    activity: {
      id: "downhill",
      season: "winter",
      title: { fi: "Laskettelu", en: "Downhill skiing" },
      body: (_l, lang) => (lang === "fi" ? "Hiihtokeskuksen rinteet ovat lähellä." : "The slopes of a ski resort are close by."),
    },
  },
  {
    when: (l) => has(l, "nearSki") || cat(l, "skiing"),
    activity: {
      id: "crossCountry",
      season: "winter",
      title: { fi: "Murtomaahiihto", en: "Cross-country skiing" },
      body: (_l, lang) => (lang === "fi" ? "Ladut kulkevat lumisen metsän halki." : "Groomed tracks through snowy forest."),
    },
  },
  {
    when: (l) => cat(l, "skiing") || (cat(l, "aurora") && ["FI", "SE"].includes(l.country)),
    activity: {
      id: "snowshoe",
      season: "winter",
      title: { fi: "Lumikenkäily", en: "Snowshoeing" },
      body: (_l, lang) => (lang === "fi" ? "Hiljaisia lumikenkäretkiä umpihangessa." : "Quiet walks across deep snow."),
    },
  },
  {
    when: (l) => cat(l, "aurora"),
    activity: {
      id: "aurora",
      season: "darkSeason",
      title: { fi: "Revontulet", en: "Northern lights" },
      body: (_l, lang) =>
        lang === "fi" ? "Pimeinä, kirkkaina öinä taivaalla voi näkyä revontulia." : "On dark, clear nights the northern lights can dance overhead.",
    },
  },
  {
    when: (l) => has(l, "hotTub", "outdoorJacuzzi", "jacuzzi"),
    activity: {
      id: "hotTub",
      season: "allYear",
      title: { fi: "Palju-illat", en: "Hot tub evenings" },
      body: (l, lang) =>
        has(l, "hotTub")
          ? lang === "fi" ? "Puulämmitteinen palju ulkona tähtien alla." : "A wood-fired hot tub outdoors, under the stars."
          : lang === "fi" ? "Poreallas rentoutumiseen päivän jälkeen." : "A jacuzzi to unwind in after the day.",
    },
  },
  {
    when: (l) => has(l, "grillHut"),
    activity: {
      id: "campfire",
      season: "allYear",
      title: { fi: "Grillikodassa", en: "Grill hut cookouts" },
      body: (_l, lang) => (lang === "fi" ? "Makkaranpaistoa ja tarinoita grillikodan tulilla." : "Cook over the open fire in the grill hut."),
    },
  },
  {
    when: (l) => has(l, "fireplace"),
    activity: {
      id: "fireside",
      season: "allYear",
      title: { fi: "Takkaillat", en: "Evenings by the fire" },
      body: (_l, lang) => (lang === "fi" ? "Takkatulen ääressä lautapelien ja kirjojen parissa." : "Board games and books by the fireplace."),
    },
  },
  {
    when: (l) => has(l, "pets"),
    activity: {
      id: "dogs",
      season: "allYear",
      title: { fi: "Lemmikki mukaan", en: "Bring your dog" },
      body: (_l, lang) => (lang === "fi" ? "Lemmikit ovat tervetulleita, ja lenkkimaastoa riittää." : "Pets are welcome, with plenty of room for walks."),
    },
  },
];

export const SEASON_LABEL: Record<Season, Text> = {
  summer: { fi: "Kesä", en: "Summer" },
  winter: { fi: "Talvi", en: "Winter" },
  autumn: { fi: "Heinä–lokakuu", en: "Jul–Oct" },
  darkSeason: { fi: "Syys–maaliskuu", en: "Sep–Mar" },
  allYear: { fi: "Ympäri vuoden", en: "All year" },
};

export type ActivityItem = { id: ActivityId; season: Season; title: string; body: string };

export function activitiesFor(l: Listing, lang: Lang): ActivityItem[] {
  return RULES.filter((r) => r.when(l)).map(({ activity: a }) => ({
    id: a.id,
    season: a.season,
    title: a.title[lang],
    body: a.body(l, lang),
  }));
}
