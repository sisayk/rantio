// The visitor's country from their IP address, for the language of their first visit
// (see firstLang in ./locales). Server only: the proxy runs in Node.js.
//
// The data is DB-IP's free "IP to Country Lite" database (CC BY 4.0; the footer links
// to DB-IP as its licence asks). deploy/geoip-update.sh downloads it to GEOIP_COUNTRY_DB
// every month. Without the file (local development) there's no country and the
// browser's language decides, as before.

import { readFileSync, statSync } from "node:fs";
import { type CountryResponse, Reader } from "mmdb-lib";

const FILE = process.env.GEOIP_COUNTRY_DB || "/srv/stugora/geoip/country.mmdb";
const RECHECK_MS = 60 * 60 * 1000; // the monthly update is picked up within an hour

let reader: Reader<CountryResponse> | null = null;
let loadedMtime = 0;
let checkedAt = 0;

function current(): Reader<CountryResponse> | null {
  const now = Date.now();
  if (now - checkedAt < RECHECK_MS) return reader;
  checkedAt = now;
  try {
    const mtime = statSync(FILE).mtimeMs;
    if (!reader || mtime !== loadedMtime) {
      reader = new Reader<CountryResponse>(readFileSync(FILE));
      loadedMtime = mtime;
    }
  } catch {
    reader = null; // no file (yet), or a broken one: no country
  }
  return reader;
}

/** "FI", "SE"… for the address nginx saw (X-Real-IP), or null if unknown. */
export function visitorCountry(headers: Headers): string | null {
  const ip = headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return null;
  try {
    return current()?.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null; // not an IP address
  }
}
