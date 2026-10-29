// Places near a cottage, from Wikipedia's geosearch (articles with coordinates).
// Runs in the guest's browser; text and photos stay on Wikipedia under CC BY-SA.
import { LANG_INFO, type Lang } from "@/i18n/locales";

export type NearbyPlace = {
  key: string;
  title: string;
  description: string;
  url: string;
  lat: number;
  lng: number;
  km: number;
  thumb?: string;
  rank: number; // 0 = national park or nature reserve ... 3 = everything else
};

const RADIUS_M = 10_000; // the most Wikipedia's geosearch allows
// Articles that are rarely worth a trip: transport, roads, schools, sports venues, admin areas.
const SKIP =
  /\b(station|railway|bus stop|road|highway|street|bridge|school|hospital|cemetery|power (plant|station)|district|electoral|parish|congregation|diocese|former municipality|municipality of|region of|company|association|club|neighbourhood|census|arena|stadium|sports venue|ice rink|championships|skiing event|sand pit|airport|borough)\b|asema|pysäkki|seisake|liikennepaikka|maantie|katu\b|silta|koulu|lukio|sairaala|hautausmaa|voimalaitos|kaupunginosa|vaalipiiri|seurakunta|hiippakunta|yhdistys|seura\b|yritys|entinen kunta|jäähalli|stadion|jalkapallo|urheilu|hiekkakuoppa|maakunta\b/i;

// What guests usually come for, best first. Anything else ranks after these, by distance.
const DRAWS: RegExp[] = [
  /national park|nature reserve|kansallispuisto|luonnonsuojelualue|luonnonpuisto|nationalpark|naturreservat/i,
  /castle|fortress|linna\b|linnoitus|museum|museo|festival|juhlat|ski resort|ski course|hiihtokeskus|laskettelukeskus|waterfall|vesiputous|koski\b|fjord|vuono|beach|uimaranta|hiekkaranta|dune|dyyni|spit\b|cave\b|luola|monument|muistomerkki|standing stone|island|saari\b|lake\b|järvi\b|fell|tunturi|vaara\b|hill|mountain|vuori\b|glacier|jäätikkö|lighthouse|majakka|manor|kartano|zoo|eläintarha|amusement park|entertainment park|huvipuisto/i,
  /church|kirkko|town|city|village|kaupunki|kylä|taajama|harbour|port\b|satama|market|tori\b|park\b|puisto/i,
];
const draw = (text: string) => {
  const i = DRAWS.findIndex((re) => re.test(text));
  return i === -1 ? DRAWS.length : i;
};

// At most two of a kind, so one list isn't eight small lakes or eight villages.
const KINDS: RegExp[] = [
  /\blakes?\b|järvi|lampi|vatnet|sjön/i,
  /village|kylä|settlement|taajama|town in|kaupunki\b/i,
  /mountain|vuori|tunturi/i,
  /church|kirkko/i,
];
const PER_KIND = 2;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

type WikiPage = {
  pageid: number;
  title: string;
  description?: string;
  fullurl: string;
  coordinates?: { lat: number; lon: number }[];
  thumbnail?: { source: string };
  extract?: string;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The short description, or else the article's first sentence, cut to a line or two. */
function blurb(p: WikiPage) {
  const name = p.title.replace(/\s*\(.*$/, ""); // "Ulvik (village)" -> "Ulvik"
  const text = (p.description || p.extract || "")
    .replace(/\s*\([^)]*\)/g, "") // (ruots. Olofsborg), (1475)
    .replace(/\s*\([^)]*$/, "") // a bracket the one-sentence extract cut open
    // "Gemla on taajama…" / "Kuressaare is a town…": the name is already the heading.
    .replace(new RegExp(`^${escape(name)}\\s+(on|oli|is an?|is the|is|was an?|was)\\s+`, "i"), "")
    .trim();
  if (!text || text.toLowerCase() === name.toLowerCase() || text.toLowerCase() === p.title.toLowerCase()) return "";
  if (text.length <= 120) return text;
  const cut = text.slice(0, 117);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

async function search(wiki: string, lat: number, lng: number, signal: AbortSignal): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: String(RADIUS_M),
    ggslimit: "40",
    prop: "coordinates|pageimages|description|info|extracts",
    exintro: "1",
    explaintext: "1",
    exsentences: "1",
    exlimit: "max",
    inprop: "url",
    piprop: "thumbnail",
    pithumbsize: "240",
    colimit: "max",
  });
  const res = await fetch(`https://${wiki}.wikipedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data: { query?: { pages?: WikiPage[] }; error?: { code: string } } = await res.json();
  if (data.error) throw new Error(`Wikipedia ${data.error.code}`); // e.g. "too busy"
  return (data.query?.pages ?? [])
    .map((p) => ({ p, text: blurb(p) }))
    .filter(({ p, text }) => p.coordinates?.length && text && !SKIP.test(text.slice(0, 90)))
    .map(({ p, text }) => {
      const c = p.coordinates![0];
      return {
        key: `${wiki}:${p.pageid}`,
        title: p.title,
        description: text.charAt(0).toUpperCase() + text.slice(1),
        url: p.fullurl,
        lat: c.lat,
        lng: c.lon,
        km: distanceKm(lat, lng, c.lat, c.lon),
        thumb: p.thumbnail?.source,
        rank: draw(`${p.title} ${text}`),
      };
    });
}

/** Up to `limit` places, sights first and then nearest. Pages in other languages add
 *  English articles their own Wikipedia lacks, since each covers fewer places abroad. */
async function lookUp(lat: number, lng: number, lang: Lang, signal: AbortSignal, limit: number) {
  // If Finnish Wikipedia doesn't answer, the English results still fill the list.
  let complete = true; // false when one language had to be skipped
  let places = await search(LANG_INFO[lang].wiki, lat, lng, signal).catch((e) => {
    if (lang === "en" || signal.aborted) throw e;
    complete = false;
    return [];
  });
  if (lang !== "en") {
    const more = await search("en", lat, lng, signal).catch((e) => {
      if (!places.length) throw e; // neither language answered
      complete = false;
      return [];
    });
    // The same place in both languages has the same name or sits at the same spot.
    const taken = (p: NearbyPlace) =>
      places.some((q) => q.title.toLowerCase() === p.title.toLowerCase() || distanceKm(p.lat, p.lng, q.lat, q.lng) < 0.3);
    places = [...places, ...more.filter((p) => !taken(p) && (places.length < 6 || p.rank <= 1))];
  }
  places.sort((a, b) => a.rank - b.rank || a.km - b.km);
  // Places with no recognisable draw only fill in when there is little else.
  const notable = places.filter((p) => p.rank < DRAWS.length);
  if (notable.length >= 5) places = notable;
  const counts = new Map<number, number>();
  const picked: NearbyPlace[] = [];
  for (const p of places) {
    const kind = KINDS.findIndex((re) => re.test(p.description));
    if (kind !== -1) {
      const n = counts.get(kind) ?? 0;
      if (n >= PER_KIND) continue;
      counts.set(kind, n + 1);
    }
    picked.push(p);
    if (picked.length === limit) break;
  }
  return { places: picked, complete };
}

// Each guest's browser keeps a cottage's places for a week, so Wikipedia is asked rarely.
const CACHE_DAYS = 7;
const cacheKey = (lat: number, lng: number, lang: Lang) => `stugora:nearby:v1:${lang}:${lat.toFixed(3)},${lng.toFixed(3)}`;

export async function findNearby(lat: number, lng: number, lang: Lang, signal: AbortSignal, limit = 16) {
  const key = cacheKey(lat, lng, lang);
  try {
    const hit = JSON.parse(localStorage.getItem(key) ?? "null") as { at: number; places: NearbyPlace[] } | null;
    if (hit && Date.now() - hit.at < CACHE_DAYS * 86_400_000) return hit.places.slice(0, limit);
  } catch {
    // storage blocked or unreadable: just ask Wikipedia
  }
  const { places, complete } = await lookUp(lat, lng, lang, signal, limit);
  if (complete) {
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), places }));
    } catch {
      // full or blocked storage only costs a repeat lookup
    }
  }
  return places;
}
