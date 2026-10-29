// Places near a cottage, from Wikipedia's geosearch (articles with coordinates).
// Runs in the guest's browser; text and photos stay on Wikipedia under CC BY-SA.
import type { Lang } from "./content";

export type NearbyPlace = {
  key: string;
  title: string;
  description: string;
  url: string;
  lat: number;
  lng: number;
  km: number;
  thumb?: string;
};

const RADIUS_M = 10_000; // the most Wikipedia's geosearch allows
// Articles that are rarely worth a trip: transport stops, roads, schools, districts.
const SKIP = /\b(station|railway|bus stop|road|highway|street|school|district|electoral|parish|municipality of|company|neighbourhood|census)\b|asema|pysäkki|maantie|katu\b|koulu|kaupunginosa|vaalipiiri|yritys/i;

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
};

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
    prop: "coordinates|pageimages|description|info",
    inprop: "url",
    piprop: "thumbnail",
    pithumbsize: "240",
    colimit: "max",
  });
  const res = await fetch(`https://${wiki}.wikipedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data: { query?: { pages?: WikiPage[] } } = await res.json();
  return (data.query?.pages ?? [])
    .filter((p) => p.coordinates?.length && p.description && !SKIP.test(p.description))
    .map((p) => {
      const c = p.coordinates![0];
      return {
        key: `${wiki}:${p.pageid}`,
        title: p.title,
        description: p.description!.charAt(0).toUpperCase() + p.description!.slice(1),
        url: p.fullurl,
        lat: c.lat,
        lng: c.lon,
        km: distanceKm(lat, lng, c.lat, c.lon),
        thumb: p.thumbnail?.source,
      };
    });
}

/** Up to `limit` places, nearest first; Finnish pages fall back to English ones when few exist. */
export async function findNearby(lat: number, lng: number, lang: Lang, signal: AbortSignal, limit = 16) {
  let places = await search(lang, lat, lng, signal);
  if (lang === "fi" && places.length < 6) {
    const more = await search("en", lat, lng, signal).catch(() => []);
    // The same place in both languages sits at the same coordinates.
    const taken = (p: NearbyPlace) => places.some((q) => distanceKm(p.lat, p.lng, q.lat, q.lng) < 0.15);
    places = [...places, ...more.filter((p) => !taken(p))];
  }
  return places.sort((a, b) => a.km - b.km).slice(0, limit);
}
