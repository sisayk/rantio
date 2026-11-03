// The visitor's country from their IP address, for the language of their first visit
// (see firstLang in ./locales). Server only: the proxy runs in Node.js.
//
// The data is the regional internet registries' public lists of which address ranges are
// registered to which country, for the countries with a site language only.
// deploy/geoip-update.py rebuilds the table at GEOIP_COUNTRY_DB every day. Without the
// file (local development) there's no country and the browser's language decides.

import { readFileSync, statSync } from "node:fs";

const FILE = process.env.GEOIP_COUNTRY_DB || "/srv/stugora/geoip/country.txt";
const RECHECK_MS = 60 * 60 * 1000; // the daily update is picked up within an hour

/** Sorted ranges per IP version; start and end are fixed-width hex, so they compare as strings. */
export type CountryTable = { 4: [string, string, string][]; 6: [string, string, string][] };

/** Reads geoip-update.py's lines: "4 c0000200 c00002ff FI". */
export function parseTable(text: string): CountryTable {
  const table: CountryTable = { 4: [], 6: [] };
  for (const line of text.split("\n")) {
    const [version, start, end, cc] = line.trim().split(" ");
    if ((version === "4" || version === "6") && start && end && cc) table[version].push([start, end, cc]);
  }
  return table;
}

/** An address as fixed-width hex (8 digits for IPv4, 32 for IPv6), or null if it isn't one. */
export function ipKey(ip: string): { version: 4 | 6; key: string } | null {
  let address = ip.trim().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) address = mapped[1];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    const parts = address.split(".").map(Number);
    if (parts.some((n) => n > 255)) return null;
    return { version: 4, key: parts.map((n) => n.toString(16).padStart(2, "0")).join("") };
  }
  if (!address.includes(":") || !/^[0-9a-f:]+$/i.test(address)) return null;
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (groups.some((g) => g.length === 0 || g.length > 4)) return null;
  return { version: 6, key: groups.map((g) => g.toLowerCase().padStart(4, "0")).join("") };
}

/** The country of `ip` in `table`, or null. Binary search over the sorted ranges. */
export function lookup(table: CountryTable, ip: string): string | null {
  const parsed = ipKey(ip);
  if (!parsed) return null;
  const rows = table[parsed.version];
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end, cc] = rows[mid];
    if (parsed.key < start) hi = mid - 1;
    else if (parsed.key > end) lo = mid + 1;
    else return cc;
  }
  return null;
}

let table: CountryTable | null = null;
let loadedMtime = 0;
let checkedAt = 0;

function current(): CountryTable | null {
  const now = Date.now();
  if (now - checkedAt < RECHECK_MS) return table;
  checkedAt = now;
  try {
    const mtime = statSync(FILE).mtimeMs;
    if (!table || mtime !== loadedMtime) {
      table = parseTable(readFileSync(FILE, "utf8"));
      loadedMtime = mtime;
    }
  } catch {
    table = null; // no file (yet): no country
  }
  return table;
}

/** "FI", "SE"… for the address nginx saw (X-Real-IP), or null if unknown. */
export function visitorCountry(headers: Headers): string | null {
  const ip = headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const t = ip ? current() : null;
  return t && ip ? lookup(t, ip) : null;
}
