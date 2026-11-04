#!/usr/bin/env node
// Builds frontend/src/lib/places.ts: country → region → city, with coordinates.
// Source: GeoNames (CC BY 4.0) via the all-the-cities npm package.
// Run in a normal terminal:  cd scripts && npm i all-the-cities && node build-places.js
"use strict";

const fs = require("fs");
const path = require("path");
const cities = require("all-the-cities");

const CITIES_PER_REGION = 12;
const TOWN_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLL"]);

// Places that matter for cottages but are too small for GeoNames' town list.
const EXTRA = {
  "Levi": [67.8045, 24.8085],
  "Ruka": [66.1663, 29.1406],
  "Saariselkä": [68.4195, 27.4136],
  "Sipoo": [60.3768, 25.2690],
  "Sälen": [61.1593, 13.2655],
  "Henne Strand": [55.7300, 8.1990],
  "Otepää": [58.0590, 26.4960],
  "Vík": [63.4186, -19.0060],
  "Lørenskog": [59.9260, 10.9600],
  "Brevik": [59.0540, 9.7000],
  "Bardufoss": [69.0650, 18.5150],
  "Karasjok": [69.4720, 25.5110],
  "Trysil": [61.3146, 12.2649],
  "Sandvika": [59.8907, 10.5238], // Bærum (GeoNames picks the one in Trøndelag)
};

// Better-known spellings for towns GeoNames lists without diacritics or in Swedish.
const SPELLING = {
  Jakobstad: "Pietarsaari", Korsholm: "Mustasaari", "Nykarleby": "Uusikaarlepyy",
  Silute: "Šilutė", Vilkaviskis: "Vilkaviškis", Birzai: "Biržai", Mazeikiai: "Mažeikiai",
  Telsiai: "Telšiai", Plunge: "Plungė", Taurage: "Tauragė", Radviliskis: "Radviliškis",
  Kupiskis: "Kupiškis", "Naujoji Akmene": "Naujoji Akmenė", Göteborg: "Gothenburg",
  "Århus": "Aarhus", Hyvinge: "Hyvinkää", Pargas: "Parainen", Vammala: "Sastamala",
  Ukmerge: "Ukmergė",
};

// Former municipalities and city districts that read oddly as "cities".
const SKIP = new Set([
  "Karhula", "Nastola", "Haukipudas", "Nurmo", "Kälviä", "Joutseno", "Kiiminki", "Jalasjärvi",
  "Vibble", "Gamla Uppsala", "Skoghall", "Sjølyststranda", "Ytrebygda", "Uuemõisa", "Tehumardi",
  "Vana-Antsla", "Huskvarna", "Brunflo", "Holmsund", "Karosta", "Krustpils", "Jaunaglona",
  "Dainava (Kaunas)", "Eiguliai", "Šilainiai", "Fabijoniškės", "Pašilaičiai", "Šeškinė", "Lazdynai",
  "Charlottenlund", "Nørresundby", "Frederiksberg", "Hvidovre", "Bolderaja", "Daugavgrīva",
  "Mežaparks", "Jumprava", "Būgai", "Simnas", "Viekšniai", "Kybartai",
  // merged into other Finnish municipalities, or villages within them
  "Halikko", "Lammi", "Hauho", "Jämsänkoski", "Korpilahti", "Alahärmä", "Lohtaja", "Ullava",
  "Artjärvi", "Järvelä", "Elimäki", "Ylämaa", "Pyhäselkä", "Broby", "Älajärvi", "Taavetti",
  "Simpele", "Väståboland", "Björlanda",
]);

// Smallest population for an ordinary village (PPL) to count as a town.
const PPL_MIN = { IS: 0, EE: 1500, LT: 3000 };

// Regions per country. `admin` pulls the largest towns from GeoNames;
// `towns` lists towns by name where GeoNames regions differ from today's.
const COUNTRIES = {
  FI: [
    ["uusimaa", "Uusimaa", "Uusimaa", { admin: "01", extra: ["Sipoo"] }],
    ["varsinais-suomi", "Southwest Finland", "Varsinais-Suomi", { admin: "02" }],
    ["satakunta", "Satakunta", "Satakunta", { admin: "04" }],
    ["kanta-hame", "Kanta-Häme", "Kanta-Häme", { admin: "05" }],
    ["pirkanmaa", "Pirkanmaa", "Pirkanmaa", { admin: "06" }],
    ["paijat-hame", "Päijät-Häme", "Päijät-Häme", { admin: "07" }],
    ["kymenlaakso", "Kymenlaakso", "Kymenlaakso", { admin: "08" }],
    ["etela-karjala", "South Karelia", "Etelä-Karjala", { admin: "09" }],
    ["etela-savo", "South Savo", "Etelä-Savo", { admin: "10" }],
    ["pohjois-savo", "North Savo", "Pohjois-Savo", { admin: "11" }],
    ["pohjois-karjala", "North Karelia", "Pohjois-Karjala", { admin: "12" }],
    ["keski-suomi", "Central Finland", "Keski-Suomi", { admin: "13" }],
    ["etela-pohjanmaa", "South Ostrobothnia", "Etelä-Pohjanmaa", { admin: "14" }],
    ["pohjanmaa", "Ostrobothnia", "Pohjanmaa", { admin: "15" }],
    ["keski-pohjanmaa", "Central Ostrobothnia", "Keski-Pohjanmaa", { admin: "16" }],
    ["pohjois-pohjanmaa", "North Ostrobothnia", "Pohjois-Pohjanmaa", { admin: "17", extra: ["Ruka"] }],
    ["kainuu", "Kainuu", "Kainuu", { admin: "18" }],
    ["lappi", "Lapland", "Lappi", { admin: "19", extra: ["Levi", "Saariselkä"] }],
    ["ahvenanmaa", "Åland", "Ahvenanmaa", { country: "AX" }],
  ],
  SE: [
    ["stockholm", "Stockholm County", "Stockholms län", { admin: "26" }],
    ["uppsala", "Uppsala County", "Uppsala län", { admin: "21" }],
    ["sodermanland", "Södermanland", "Södermanlands län", { admin: "18" }],
    ["ostergotland", "Östergötland", "Östergötlands län", { admin: "16" }],
    ["jonkoping", "Jönköping County", "Jönköpings län", { admin: "08" }],
    ["kronoberg", "Kronoberg", "Kronobergs län", { admin: "12" }],
    ["kalmar", "Kalmar County", "Kalmar län", { admin: "09" }],
    ["gotland", "Gotland", "Gotlands län", { admin: "05" }],
    ["blekinge", "Blekinge", "Blekinge län", { admin: "02" }],
    ["skane", "Skåne", "Skåne län", { admin: "27" }],
    ["halland", "Halland", "Hallands län", { admin: "06" }],
    ["vastra-gotaland", "Västra Götaland", "Västra Götalands län", { admin: "28" }],
    ["varmland", "Värmland", "Värmlands län", { admin: "22" }],
    ["orebro", "Örebro County", "Örebro län", { admin: "15" }],
    ["vastmanland", "Västmanland", "Västmanlands län", { admin: "25" }],
    ["dalarna", "Dalarna", "Dalarnas län", { admin: "10", extra: ["Sälen"] }],
    ["gavleborg", "Gävleborg", "Gävleborgs län", { admin: "03" }],
    ["vasternorrland", "Västernorrland", "Västernorrlands län", { admin: "24" }],
    ["jamtland", "Jämtland", "Jämtlands län", { admin: "07" }],
    ["vasterbotten", "Västerbotten", "Västerbottens län", { admin: "23" }],
    ["norrbotten", "Norrbotten", "Norrbottens län", { admin: "14" }],
  ],
  // Norway's 15 counties since 1 January 2024.
  NO: [
    ["oslo", "Oslo", "Oslo", { towns: ["Oslo"] }],
    ["akershus", "Akershus", "Akershus", { towns: ["Lillestrøm", "Sandvika", "Asker", "Ski", "Jessheim", "Lørenskog", "Drøbak", "Ås", "Nesoddtangen"] }],
    ["ostfold", "Østfold", "Østfold", { towns: ["Fredrikstad", "Sarpsborg", "Moss", "Halden", "Askim", "Mysen"] }],
    ["buskerud", "Buskerud", "Buskerud", { towns: ["Drammen", "Kongsberg", "Hønefoss", "Gol", "Geilo", "Hemsedal", "Nesbyen", "Ål"] }],
    ["innlandet", "Innlandet", "Innlandet", { admin: "34", extra: ["Trysil"] }],
    ["vestfold", "Vestfold", "Vestfold", { towns: ["Sandefjord", "Tønsberg", "Larvik", "Horten", "Holmestrand", "Stavern"] }],
    ["telemark", "Telemark", "Telemark", { towns: ["Skien", "Porsgrunn", "Notodden", "Kragerø", "Rjukan", "Bø", "Brevik"] }],
    ["agder", "Agder", "Agder", { admin: "42" }],
    ["rogaland", "Rogaland", "Rogaland", { admin: "14" }],
    ["vestland", "Vestland", "Vestland", { admin: "46", extra: ["Ulvik"] }],
    ["more-og-romsdal", "Møre og Romsdal", "Møre og Romsdal", { admin: "08" }],
    ["trondelag", "Trøndelag", "Trøndelag", { admin: "21" }],
    ["nordland", "Nordland", "Nordland", { admin: "09", extra: ["Reine", "Svolvær", "Leknes"] }],
    ["troms", "Troms", "Troms", { towns: ["Tromsø", "Harstad", "Finnsnes", "Bardufoss", "Storslett"] }],
    ["finnmark", "Finnmark", "Finnmark", { towns: ["Alta", "Hammerfest", "Vadsø", "Kirkenes", "Honningsvåg", "Karasjok", "Vardø"] }],
  ],
  DK: [
    ["hovedstaden", "Capital Region", "Region Hovedstaden", { admin: "17", extra: ["Rønne", "Gilleleje"] }],
    ["sjaelland", "Zealand", "Region Sjælland", { admin: "20" }],
    ["syddanmark", "Southern Denmark", "Region Syddanmark", { admin: "21", extra: ["Henne Strand"] }],
    ["midtjylland", "Central Jutland", "Region Midtjylland", { admin: "18" }],
    ["nordjylland", "North Jutland", "Region Nordjylland", { admin: "19", extra: ["Skagen", "Løkken"] }],
  ],
  IS: [
    ["hofudborgarsvaedid", "Capital Region", "Höfuðborgarsvæðið", { admin: "39" }],
    ["sudurnes", "Southern Peninsula", "Suðurnes", { admin: "43" }],
    ["vesturland", "West Iceland", "Vesturland", { admin: "45" }],
    ["vestfirdir", "Westfjords", "Vestfirðir", { admin: "44" }],
    ["nordurland-vestra", "Northwest Iceland", "Norðurland vestra", { admin: "41" }],
    ["nordurland-eystra", "Northeast Iceland", "Norðurland eystra", { admin: "40" }],
    ["austurland", "East Iceland", "Austurland", { admin: "38" }],
    ["sudurland", "South Iceland", "Suðurland", { admin: "42", extra: ["Vík"] }],
  ],
  EE: [
    ["harjumaa", "Harju County", "Harjumaa", { admin: "01" }],
    ["hiiumaa", "Hiiu County", "Hiiumaa", { admin: "02" }],
    ["ida-virumaa", "Ida-Viru County", "Ida-Virumaa", { admin: "03" }],
    ["jarvamaa", "Järva County", "Järvamaa", { admin: "04" }],
    ["jogevamaa", "Jõgeva County", "Jõgevamaa", { admin: "05" }],
    ["laanemaa", "Lääne County", "Läänemaa", { admin: "07" }],
    ["laane-virumaa", "Lääne-Viru County", "Lääne-Virumaa", { admin: "08" }],
    ["parnumaa", "Pärnu County", "Pärnumaa", { admin: "11" }],
    ["polvamaa", "Põlva County", "Põlvamaa", { admin: "12" }],
    ["raplamaa", "Rapla County", "Raplamaa", { admin: "13" }],
    ["saaremaa", "Saare County", "Saaremaa", { admin: "14", extra: ["Orissaare"] }],
    ["tartumaa", "Tartu County", "Tartumaa", { admin: "18" }],
    ["valgamaa", "Valga County", "Valgamaa", { admin: "19", extra: ["Otepää"] }],
    ["viljandimaa", "Viljandi County", "Viljandimaa", { admin: "20" }],
    ["vorumaa", "Võru County", "Võrumaa", { admin: "21" }],
  ],
  // Latvia's historical regions, which is how visitors know the country.
  LV: [
    ["riga", "Riga and Jūrmala", "Rīga un Jūrmala", { towns: ["Riga", "Jūrmala", "Saulkrasti", "Salaspils", "Ogre", "Ādaži", "Baldone", "Ikšķile"] }],
    ["vidzeme", "Vidzeme", "Vidzeme", { towns: ["Valmiera", "Cēsis", "Sigulda", "Limbaži", "Alūksne", "Gulbene", "Madona", "Smiltene", "Valka"] }],
    ["kurzeme", "Kurzeme", "Kurzeme", { towns: ["Liepāja", "Ventspils", "Kuldīga", "Talsi", "Tukums", "Saldus", "Aizpute", "Grobiņa", "Sabile"] }],
    ["zemgale", "Zemgale", "Zemgale", { towns: ["Jelgava", "Bauska", "Dobele", "Iecava", "Auce", "Aizkraukle"] }],
    ["latgale", "Latgale", "Latgale", { towns: ["Daugavpils", "Rēzekne", "Jēkabpils", "Ludza", "Krāslava", "Preiļi", "Balvi", "Dagda", "Aglona"] }],
  ],
  LT: [
    ["vilnius", "Vilnius County", "Vilniaus apskritis", { admin: "65" }],
    ["kaunas", "Kaunas County", "Kauno apskritis", { admin: "57" }],
    ["klaipeda", "Klaipėda County", "Klaipėdos apskritis", { admin: "58", extra: ["Nida"] }],
    ["siauliai", "Šiauliai County", "Šiaulių apskritis", { admin: "61" }],
    ["panevezys", "Panevėžys County", "Panevėžio apskritis", { admin: "60" }],
    ["alytus", "Alytus County", "Alytaus apskritis", { admin: "56" }],
    ["marijampole", "Marijampolė County", "Marijampolės apskritis", { admin: "59" }],
    ["taurage", "Tauragė County", "Tauragės apskritis", { admin: "62" }],
    ["telsiai", "Telšiai County", "Telšių apskritis", { admin: "63" }],
    ["utena", "Utena County", "Utenos apskritis", { admin: "64" }],
  ],
};

const round = (n) => Math.round(n * 10000) / 10000;
const spell = (name) => SPELLING[name] ?? name;
const isTown = (c) => !SKIP.has(c.name) && c.featureCode !== "PPLX" &&
  (TOWN_CODES.has(c.featureCode) || c.population >= (PPL_MIN[c.country] ?? 10000));

function findTown(cc, name) {
  if (EXTRA[name]) return { name, lat: EXTRA[name][0], lng: EXTRA[name][1] };
  const hits = cities.filter((c) => c.country === cc && (c.name === name || c.altName === name))
    .sort((a, b) => b.population - a.population);
  if (!hits.length) return null;
  const [lng, lat] = hits[0].loc.coordinates;
  return { name: spell(name), lat: round(lat), lng: round(lng) };
}

const missing = [];
const out = {};
for (const [cc, regions] of Object.entries(COUNTRIES)) {
  out[cc] = regions.map(([id, en, local, src]) => {
    let towns;
    if (src.towns) {
      towns = src.towns.map((n) => findTown(cc, n) ?? (missing.push(`${cc}/${id}: ${n}`), null)).filter(Boolean);
    } else {
      const country = src.country ?? cc;
      towns = cities
        .filter((c) => c.country === country && (src.country || c.adminCode === src.admin) && isTown(c))
        .sort((a, b) => b.population - a.population)
        .slice(0, CITIES_PER_REGION)
        .map((c) => ({ name: spell(c.name), lat: round(c.loc.coordinates[1]), lng: round(c.loc.coordinates[0]) }));
      for (const n of src.extra ?? []) {
        if (towns.some((t) => t.name === spell(n))) continue;
        const t = findTown(cc, n);
        if (t) towns.push(t); else missing.push(`${cc}/${id}: ${n}`);
      }
    }
    const seen = new Set();
    towns = towns.filter((t) => !seen.has(t.name) && seen.add(t.name));
    if (!towns.length) missing.push(`${cc}/${id}: no towns`);
    return { id, name: { en, fi: cc === "FI" ? local : en, local }, cities: towns };
  });
}

const header = `// Generated by scripts/build-places.js. Do not edit by hand; edit the script and rerun it.
// Countries, regions and towns with coordinates. Town data: GeoNames (CC BY 4.0).
import type { Country } from "./listings";

export type City = { name: string; lat: number; lng: number };
export type Region = { id: string; name: { en: string; fi: string; local: string }; cities: City[] };

`;
const body = `export const PLACES: Record<Country, Region[]> = ${JSON.stringify(out)};\n`;
const target = path.join(__dirname, "..", "frontend", "src", "lib", "places.ts");
fs.writeFileSync(target, header + body);

// ---------- map bounds: frontend/src/lib/regionBounds.ts ----------
// Each region's extent from every GeoNames place in it (population 1,000 and up), so the
// owners' map can open on the region they chose. Regions given as a town list use all places
// in those towns' GeoNames areas, unless another region shares that area; then the towns only.
const PAD = 0.08; // a little room around the outermost places
const MIN_LAT = 0.5;
const MIN_LNG = 1.0;
// Where GeoNames has too few places to show a region's real extent (Iceland's thinly
// settled regions, Gotland and Hiiumaa with their islands): approximate bounds by hand.
const BOUNDS_BY_HAND = {
  "IS/hofudborgarsvaedid": [63.95, -22.15, 64.35, -21.25],
  "IS/sudurnes": [63.78, -22.75, 64.15, -21.95],
  "IS/vesturland": [64.3, -24.1, 65.6, -20.8],
  "IS/vestfirdir": [65.35, -24.55, 66.55, -21.3],
  "IS/nordurland-vestra": [64.9, -21.3, 66.2, -18.6],
  "IS/nordurland-eystra": [64.9, -19.0, 66.6, -14.5],
  "IS/austurland": [64.2, -16.0, 66.2, -13.4],
  "IS/sudurland": [63.3, -21.8, 64.9, -15.0],
  "SE/gotland": [56.88, 18.05, 58.0, 19.35],
  "EE/hiiumaa": [58.7, 22.0, 59.1, 23.05],
};
const placeKey = (c) => `${c.country}:${c.adminCode}`;
const townAreas = {};
for (const [cc, regions] of Object.entries(COUNTRIES)) {
  for (const [id, , , src] of regions) {
    if (!src.towns) continue;
    const keys = new Set();
    for (const n of src.towns) {
      const hit = cities.filter((c) => c.country === cc && (c.name === n || c.altName === n)).sort((a, b) => b.population - a.population)[0];
      if (hit) keys.add(placeKey(hit));
    }
    townAreas[`${cc}/${id}`] = keys;
  }
}
const areaUse = {};
for (const keys of Object.values(townAreas)) for (const k of keys) areaUse[k] = (areaUse[k] ?? 0) + 1;

function extent(points) {
  let [s, w, n, e] = [90, 180, -90, -180];
  for (const [lat, lng] of points) {
    s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lng); e = Math.max(e, lng);
  }
  const padLat = Math.max((n - s) * PAD, (MIN_LAT - (n - s)) / 2, 0);
  const padLng = Math.max((e - w) * PAD, (MIN_LNG - (e - w)) / 2, 0);
  return [s - padLat, w - padLng, n + padLat, e + padLng].map((x) => Math.round(x * 1000) / 1000);
}

const bounds = {};
const countryBounds = {};
for (const [cc, regions] of Object.entries(COUNTRIES)) {
  bounds[cc] = {};
  const all = [];
  for (const [id, , , src] of regions) {
    let points;
    if (src.towns) {
      // GeoNames' areas behind the listed towns, kept near the towns (a name can match far away).
      const keys = [...townAreas[`${cc}/${id}`]].filter((k) => areaUse[k] === 1);
      const listed = out[cc].find((r) => r.id === id).cities;
      const midLat = listed.reduce((n, t) => n + t.lat, 0) / listed.length;
      const midLng = listed.reduce((n, t) => n + t.lng, 0) / listed.length;
      points = cities.filter((c) => keys.includes(placeKey(c)))
        .map((c) => [c.loc.coordinates[1], c.loc.coordinates[0]])
        .filter(([lat, lng]) => Math.abs(lat - midLat) < 1.5 && Math.abs(lng - midLng) < 3);
    } else {
      const country = src.country ?? cc;
      points = cities.filter((c) => c.country === country && (src.country || c.adminCode === src.admin))
        .map((c) => [c.loc.coordinates[1], c.loc.coordinates[0]]);
    }
    const region = out[cc].find((r) => r.id === id);
    points = points.concat(region.cities.map((t) => [t.lat, t.lng]));
    bounds[cc][id] = BOUNDS_BY_HAND[`${cc}/${id}`] ?? extent(points);
    all.push(...points, [bounds[cc][id][0], bounds[cc][id][1]], [bounds[cc][id][2], bounds[cc][id][3]]);
  }
  countryBounds[cc] = extent(all);
}
const boundsFile = `// Generated by scripts/build-places.js. Do not edit by hand; edit the script and rerun it.
// [south, west, north, east] of each region and country, from GeoNames places (CC BY 4.0).
import type { Country } from "./listings";

export type Bounds = [number, number, number, number];

export const REGION_BOUNDS: Record<Country, Record<string, Bounds>> = ${JSON.stringify(bounds)};

export const COUNTRY_BOUNDS: Record<Country, Bounds> = ${JSON.stringify(countryBounds)};
`;
fs.writeFileSync(path.join(__dirname, "..", "frontend", "src", "lib", "regionBounds.ts"), boundsFile);

const regionCount = Object.values(out).reduce((n, r) => n + r.length, 0);
const cityCount = Object.values(out).flat().reduce((n, r) => n + r.cities.length, 0);
console.log(`Wrote ${regionCount} regions and ${cityCount} towns to ${path.relative(process.cwd(), target)}`);
if (missing.length) console.log("Not found:", missing.join("; "));
