// Amenity icons: one registry for the website and the app, keyed by the stable amenity keys
// (catalog.ts FEATURE_GROUPS and amenities.ts EDITOR_AMENITIES), never by translated names.
//
// Each icon is a 24×24 outline drawing, stroke only, as a list of SVG elements. The website
// draws them with <svg> (components/AmenityIcon.tsx), the app with react-native-svg
// (mobile/src/ui/amenity-icon.tsx), so both show exactly the same icon in every language.
//
// Most icons are Lucide 1.66.0 (https://lucide.dev), copied in rather than installed so the
// two platforms share one file; the rest are Rantio's own, drawn on the same grid and stroke
// for cottage things Lucide doesn't have (sauna stoves, shores, the kota, the outhouse…).
// Rantio's own: accessibleBathroom, accessibleParking, babyBed, balcony, barbecue, boat, carriedWater, coAlarm, dishwasher, dryingCabinet, electricSauna, grillHut, heatPump, highChair, hotTub, jacuzzi, jetty, lake, loft, outdoorJacuzzi, outdoorWc, oven, playground, pond, privateShore, river, sharedShore, smokeSauna, stepFree, stove, tumbleDryer, waterAccess, woodSauna.
//
// To add an amenity: add its key where amenities are defined, then a line in AMENITY_ICONS
// below. TypeScript refuses to build until every key has an icon.
//
// Lucide icons:
// ISC License
//
// Copyright (c) 2026 Lucide Icons and Contributors
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

import type { AmenityKey } from "./amenities";

export type IconElement = readonly ["path" | "circle" | "rect" | "line" | "polyline" | "ellipse" | "polygon", Readonly<Record<string, string | number>>];
export type IconNode = readonly IconElement[];

const GLYPHS = {
  accessibility: [["circle", { cx: 16, cy: 4, r: 1 }], ["path", { d: "m18 19 1-7-6 1" }], ["path", { d: "m5 8 3-3 5.5 3-2.36 3.5" }], ["path", { d: "M4.24 14.5a5 5 0 0 0 6.88 6" }], ["path", { d: "M13.76 17.5a5 5 0 0 0-6.88-6" }]],
  accessibleBathroom: [["path", { d: "M5 12h11a1 1 0 0 1 1 1 4.5 4.5 0 0 1-4.5 4.5h-.5l1.3 3.5H5.5L7 17.5a5 5 0 0 1-4-5V5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 2 2v7" }], ["path", { d: "M20 3v9" }], ["path", { d: "M20 7.5h-3" }]],
  accessibleParking: [["rect", { x: 2, y: 3, width: 20, height: 18, rx: 2 }], ["path", { d: "M6 17V7h3.5a3 3 0 0 1 0 6H6" }], ["circle", { cx: 16.5, cy: 7.5, r: 1 }], ["path", { d: "M16.5 9.5v3.5h2.5l1 2.5" }], ["path", { d: "M14.4 12a3.3 3.3 0 1 0 4.6 4.3" }]],
  "air-vent": [["path", { d: "M18 17.5a2.5 2.5 0 1 1-4 2.03V12" }], ["path", { d: "M6 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }], ["path", { d: "M6 8h12" }], ["path", { d: "M6.6 15.572A2 2 0 1 0 10 17v-5" }]],
  "alarm-smoke": [["path", { d: "M11 21c0-2.5 2-2.5 2-5" }], ["path", { d: "M16 21c0-2.5 2-2.5 2-5" }], ["path", { d: "m19 8-.8 3a1.25 1.25 0 0 1-1.2 1H7a1.25 1.25 0 0 1-1.2-1L5 8" }], ["path", { d: "M21 3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z" }], ["path", { d: "M6 21c0-2.5 2-2.5 2-5" }]],
  babyBed: [["path", { d: "M3 5v16" }], ["path", { d: "M21 5v16" }], ["path", { d: "M3 8h18" }], ["path", { d: "M3 17h18" }], ["path", { d: "M7 8v9" }], ["path", { d: "M10.5 8v9" }], ["path", { d: "M14 8v9" }], ["path", { d: "M17.5 8v9" }]],
  balcony: [["path", { d: "M7 13V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9" }], ["path", { d: "M14.5 8.5v1" }], ["path", { d: "M3 13h18" }], ["path", { d: "M3 20h18" }], ["path", { d: "M5 13v7" }], ["path", { d: "M9 13v7" }], ["path", { d: "M12 13v7" }], ["path", { d: "M15 13v7" }], ["path", { d: "M19 13v7" }]],
  barbecue: [["path", { d: "M4 10h16a8 8 0 0 1-16 0Z" }], ["path", { d: "M8 17.5 6 22" }], ["path", { d: "M16 17.5l2 4.5" }], ["path", { d: "M12 18v4" }], ["path", { d: "M9 6.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }], ["path", { d: "M15 6.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }]],
  "bed-double": [["path", { d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" }], ["path", { d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" }], ["path", { d: "M12 4v6" }], ["path", { d: "M2 18h20" }]],
  boat: [["path", { d: "M2 13h20l-2.4 4.4a2 2 0 0 1-1.8 1.1H6.2a2 2 0 0 1-1.8-1.1Z" }], ["path", { d: "M7 13V9.5" }], ["path", { d: "M17 13V9.5" }], ["path", { d: "M3 3.5l15.5 14" }], ["path", { d: "M3.2 3.3c.8-.9 2.2-.8 3 .2L7.6 5l-2.1 1.9-1.4-1.5c-.9-1-.9-1.6-.9-2.1Z" }], ["path", { d: "M2 21.5q2.5 2 5 0t5 0t5 0t5 0" }]],
  "brick-wall-fire": [["path", { d: "M16 3v2.107" }], ["path", { d: "M17 9c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 22 17a5 5 0 0 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C13 11.5 16 9 17 9" }], ["path", { d: "M21 8.274V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.938" }], ["path", { d: "M3 15h5.253" }], ["path", { d: "M3 9h8.228" }], ["path", { d: "M8 15v6" }], ["path", { d: "M8 3v6" }]],
  "briefcase-medical": [["path", { d: "M12 11v4" }], ["path", { d: "M14 13h-4" }], ["path", { d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" }], ["path", { d: "M18 6v14" }], ["path", { d: "M6 6v14" }], ["rect", { width: 20, height: 14, x: 2, y: 6, rx: 2 }]],
  "calendar-check": [["path", { d: "M8 2v3" }], ["path", { d: "M16 2v3" }], ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ["path", { d: "M3 9h18" }], ["path", { d: "m9 15 2 2 4-4" }]],
  "car-front": [["path", { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" }], ["path", { d: "M7 14h.01" }], ["path", { d: "M17 14h.01" }], ["rect", { width: 18, height: 8, x: 3, y: 10, rx: 2 }], ["path", { d: "M5 18v2" }], ["path", { d: "M19 18v2" }]],
  carriedWater: [["path", { d: "M5 9.5h14l-1.5 10.7a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3Z" }], ["path", { d: "M5.5 9.5a6.5 6.5 0 0 1 13 0" }], ["path", { d: "M12 12.5c1.1 1.3 1.9 2.4 1.9 3.4a1.9 1.9 0 0 1-3.8 0c0-1 .8-2.1 1.9-3.4Z" }]],
  "circle-dot": [["circle", { cx: 12, cy: 12, r: 1 }], ["circle", { cx: 12, cy: 12, r: 10 }]],
  coAlarm: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M10.8 10.3a2.2 2.2 0 1 0 0 3.4" }], ["circle", { cx: 15, cy: 12, r: 1.8 }]],
  coffee: [["path", { d: "M10 2v2" }], ["path", { d: "M14 2v2" }], ["path", { d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" }], ["path", { d: "M6 2v2" }]],
  "cooking-pot": [["path", { d: "M2 12h20" }], ["path", { d: "M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" }], ["path", { d: "m4 8 16-4" }], ["path", { d: "m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8" }]],
  dishwasher: [["rect", { x: 3, y: 2, width: 18, height: 20, rx: 2 }], ["path", { d: "M3 7h18" }], ["path", { d: "M6.5 4.5h.01" }], ["path", { d: "M9.5 4.5h.01" }], ["circle", { cx: 14.5, cy: 13.5, r: 3 }], ["circle", { cx: 9, cy: 14, r: 2 }], ["path", { d: "M6 18.5h12" }]],
  dryingCabinet: [["rect", { x: 4, y: 2, width: 16, height: 20, rx: 1.5 }], ["path", { d: "M12 6.5a1.2 1.2 0 1 1 1.2 1.2c-.7 0-1.2.4-1.2 1V9" }], ["path", { d: "M12 9 7 13h10Z" }], ["path", { d: "M9 19c-.6-.6.6-1.2 0-1.8" }], ["path", { d: "M12 19c-.6-.6.6-1.2 0-1.8" }], ["path", { d: "M15 19c-.6-.6.6-1.2 0-1.8" }]],
  electricSauna: [["rect", { x: 5, y: 11, width: 14, height: 11, rx: 1.5 }], ["circle", { cx: 8.5, cy: 9, r: 1.6 }], ["circle", { cx: 12, cy: 8.5, r: 1.6 }], ["circle", { cx: 15.5, cy: 9, r: 1.6 }], ["path", { d: "m13 13.5-2.5 3.5h3L11 20.5" }], ["path", { d: "M8.5 5.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }], ["path", { d: "M12 5c-1-.8 1-1.6 0-2.5" }], ["path", { d: "M15.5 5.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }]],
  "ev-charger": [["path", { d: "M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" }], ["path", { d: "M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" }], ["path", { d: "M2 21h13" }], ["path", { d: "M3 7h11" }], ["path", { d: "m9 11-2 3h3l-2 3" }]],
  fence: [["path", { d: "M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" }], ["path", { d: "M6 8h4" }], ["path", { d: "M6 18h4" }], ["path", { d: "m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" }], ["path", { d: "M14 8h4" }], ["path", { d: "M14 18h4" }], ["path", { d: "m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" }]],
  "fire-extinguisher": [["path", { d: "M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5" }], ["path", { d: "M9 18h8" }], ["path", { d: "M18 3h-3" }], ["path", { d: "M11 3a6 6 0 0 0-6 6v11" }], ["path", { d: "M5 13h4" }], ["path", { d: "M17 10a4 4 0 0 0-8 0v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2Z" }]],
  "fishing-rod": [["path", { d: "M4 11h1" }], ["path", { d: "M8 15a2 2 0 0 1-4 0V3a1 1 0 0 1 1-1h.5C14 2 20 9 20 18v4" }], ["circle", { cx: 18, cy: 18, r: 2 }]],
  "flame-kindling": [["path", { d: "M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 17 10a5 5 0 1 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C8 4.5 11 2 12 2Z" }], ["path", { d: "m5 22 14-4" }], ["path", { d: "m5 18 14 4" }]],
  "flower-2": [["path", { d: "M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1" }], ["circle", { cx: 12, cy: 8, r: 2 }], ["path", { d: "M12 10v12" }], ["path", { d: "M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z" }], ["path", { d: "M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z" }]],
  footprints: [["path", { d: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" }], ["path", { d: "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" }], ["path", { d: "M16 17h4" }], ["path", { d: "M4 13h4" }]],
  grillHut: [["path", { d: "M2.5 21 12 4l9.5 17" }], ["path", { d: "M12 4V1.5" }], ["path", { d: "M9.5 21v-3.5a2.5 2.5 0 0 1 5 0V21" }], ["path", { d: "M2 21h20" }], ["path", { d: "M12 13.5c-.9.9-1.4 1.6-1.4 2.2a1.4 1.4 0 0 0 2.8 0c0-.6-.5-1.3-1.4-2.2Z" }]],
  heatPump: [["rect", { x: 2, y: 4, width: 20, height: 14, rx: 2 }], ["circle", { cx: 9, cy: 11, r: 4.5 }], ["circle", { cx: 9, cy: 11, r: 1 }], ["path", { d: "M9 6.5v3.5" }], ["path", { d: "M5.1 13.3l3-1.8" }], ["path", { d: "M12.9 13.3l-3-1.8" }], ["path", { d: "M16 8h3" }], ["path", { d: "M16 11h3" }], ["path", { d: "M16 14h3" }], ["path", { d: "M5 18v3" }], ["path", { d: "M19 18v3" }]],
  highChair: [["path", { d: "M8 11V3.5h8V11" }], ["path", { d: "M6 11h12" }], ["path", { d: "M5 7.5h4" }], ["path", { d: "M8 11 5 21.5" }], ["path", { d: "M16 11l3 10.5" }], ["path", { d: "M6.4 16.5h11.2" }]],
  hotTub: [["path", { d: "M4 10.5h16l-1.6 9.6a1.5 1.5 0 0 1-1.5 1.3H7.1a1.5 1.5 0 0 1-1.5-1.3Z" }], ["path", { d: "M4.5 14h15" }], ["path", { d: "M9 10.5v11" }], ["path", { d: "M15 10.5v11" }], ["path", { d: "M8 7c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }], ["path", { d: "M12 6.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }], ["path", { d: "M16 7c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }]],
  jacuzzi: [["path", { d: "M2 12h20v2a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6Z" }], ["path", { d: "M6 20l-1 2" }], ["path", { d: "M18 20l1 2" }], ["circle", { cx: 8, cy: 8.5, r: 1.2 }], ["circle", { cx: 12.5, cy: 6.5, r: 1.2 }], ["circle", { cx: 16, cy: 9, r: 1.2 }], ["circle", { cx: 11, cy: 3, r: 0.8 }]],
  jetty: [["path", { d: "M2 9h20" }], ["path", { d: "M2 12h20" }], ["path", { d: "M5 12v8" }], ["path", { d: "M19 12v8" }], ["path", { d: "M5 9V5" }], ["path", { d: "M19 9V5" }], ["path", { d: "M5 6h14" }], ["path", { d: "M2 17q2.5 2 5 0t5 0t5 0t5 0" }]],
  kayak: [["path", { d: "M18 17a1 1 0 0 0-1 1v1a2 2 0 1 0 2-2z" }], ["path", { d: "M20.97 3.61a.45.45 0 0 0-.58-.58C10.2 6.6 6.6 10.2 3.03 20.39a.45.45 0 0 0 .58.58C13.8 17.4 17.4 13.8 20.97 3.61" }], ["path", { d: "m6.707 6.707 10.586 10.586" }], ["path", { d: "M7 5a2 2 0 1 0-2 2h1a1 1 0 0 0 1-1z" }]],
  lake: [["path", { d: "M7 2.5 4 7.5h2l-2.5 4h7L8 7.5h2Z" }], ["path", { d: "M7 11.5v2" }], ["path", { d: "M14 11.5l2.5-3.5 2.5 3 1-1 2 1.5" }], ["path", { d: "M2 17q2.5 2 5 0t5 0t5 0t5 0" }], ["path", { d: "M2 21q2.5 2 5 0t5 0t5 0t5 0" }]],
  loft: [["path", { d: "M17 3v18" }], ["path", { d: "M21 3v18" }], ["path", { d: "M17 7h4" }], ["path", { d: "M17 11h4" }], ["path", { d: "M17 15h4" }], ["path", { d: "M17 19h4" }], ["path", { d: "M2 10h15" }], ["path", { d: "M3 10v11" }], ["path", { d: "M2 7.5h12v2.5" }], ["path", { d: "M3.5 7.5V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" }]],
  logs: [["path", { d: "M3 5h1" }], ["path", { d: "M3 12h1" }], ["path", { d: "M3 19h1" }], ["path", { d: "M8 5h1" }], ["path", { d: "M8 12h1" }], ["path", { d: "M8 19h1" }], ["path", { d: "M13 5h8" }], ["path", { d: "M13 12h8" }], ["path", { d: "M13 19h8" }]],
  microwave: [["rect", { width: 20, height: 15, x: 2, y: 4, rx: 2 }], ["rect", { width: 8, height: 7, x: 6, y: 8, rx: 1 }], ["path", { d: "M18 8v7" }], ["path", { d: "M6 19v2" }], ["path", { d: "M18 19v2" }]],
  "mountain-snow": [["path", { d: "m8 3 4 8 5-5 5 15H2L8 3z" }], ["path", { d: "M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" }]],
  outdoorJacuzzi: [["path", { d: "M2 13h14v1.5a5.5 5.5 0 0 1-5.5 5.5h-3A5.5 5.5 0 0 1 2 14.5Z" }], ["circle", { cx: 6, cy: 9.5, r: 1.2 }], ["circle", { cx: 10.5, cy: 8, r: 1.2 }], ["circle", { cx: 8.5, cy: 4.5, r: 0.8 }], ["path", { d: "M19 2.5 16.5 7h1.8l-2.3 4h6l-2.3-4h1.8Z" }], ["path", { d: "M19 11v10" }], ["path", { d: "M14 21h8" }]],
  outdoorWc: [["path", { d: "M3.5 8.5 12 3l8.5 5.5" }], ["path", { d: "M5.5 7.5V21h13V7.5" }], ["path", { d: "M9.5 21v-9h5v9" }], ["path", { d: "M12.8 8.4a1.3 1.3 0 1 1-1.2-1.8 1 1 0 0 0 1.2 1.8Z" }], ["path", { d: "M2 21h20" }]],
  oven: [["rect", { x: 3, y: 2, width: 18, height: 20, rx: 2 }], ["path", { d: "M3 7h18" }], ["path", { d: "M7 4.5h.01" }], ["path", { d: "M11 4.5h.01" }], ["path", { d: "M15 4.5h3" }], ["rect", { x: 6.5, y: 10, width: 11, height: 8, rx: 1 }], ["path", { d: "M9 13.5h6" }]],
  "paw-print": [["circle", { cx: 11, cy: 4, r: 2 }], ["circle", { cx: 18, cy: 8, r: 2 }], ["circle", { cx: 20, cy: 16, r: 2 }], ["path", { d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" }]],
  playground: [["path", { d: "M5 3 2.5 21" }], ["path", { d: "M19 3l2.5 18" }], ["path", { d: "M4 3h16" }], ["path", { d: "M10 3v11" }], ["path", { d: "M14 3v11" }], ["path", { d: "M8.5 14h7" }], ["path", { d: "M2 21h20" }]],
  pond: [["rect", { x: 8, y: 3.5, width: 2, height: 4.5, rx: 1 }], ["path", { d: "M9 8v5.5" }], ["path", { d: "M12.5 7v6.5" }], ["path", { d: "M15.5 13.5c0-2.5.8-4 2.5-5" }], ["path", { d: "M6 13.5c0-2-.6-3.5-2-4.5" }], ["path", { d: "M3 17.5c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4-9-1.8-9-4Z" }]],
  privateShore: [["path", { d: "M3 10.5 9 5.5l6 5" }], ["path", { d: "M4.5 9.5v5h9v-5" }], ["path", { d: "M8 14.5v-3h2v3" }], ["path", { d: "M17 4v6.5" }], ["path", { d: "M17 4.5h3.5l-1 1.5 1 1.5H17" }], ["path", { d: "M2 18.5q2.5 2 5 0t5 0t5 0t5 0" }]],
  refrigerator: [["path", { d: "M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" }], ["path", { d: "M5 10h14" }], ["path", { d: "M15 7v6" }]],
  river: [["path", { d: "M4 2c0 4 5 5 5 10s-5 6-5 10" }], ["path", { d: "M14 2c0 4 5 5 5 10s-5 6-5 10" }], ["path", { d: "M10.5 7.5q1.5 1 3 0" }], ["path", { d: "M10 15.5q1.5 1 3 0" }]],
  "rocking-chair": [["path", { d: "m15 13 3.708 7.416" }], ["path", { d: "M3 19a15 15 0 0 0 18 0" }], ["path", { d: "m3 2 3.21 9.633A2 2 0 0 0 8.109 13H18" }], ["path", { d: "m9 13-3.708 7.416" }]],
  sharedShore: [["circle", { cx: 7, cy: 4.5, r: 2 }], ["circle", { cx: 16, cy: 4.5, r: 2 }], ["path", { d: "M3 13v-1a4 4 0 0 1 8 0v1" }], ["path", { d: "M12 13v-1a4 4 0 0 1 8 0v1" }], ["path", { d: "M2 17q2.5 2 5 0t5 0t5 0t5 0" }], ["path", { d: "M2 21q2.5 2 5 0t5 0t5 0t5 0" }]],
  "shower-head": [["path", { d: "m4 4 2.5 2.5" }], ["path", { d: "M13.5 6.5a4.95 4.95 0 0 0-7 7" }], ["path", { d: "M15 5 5 15" }], ["path", { d: "M14 17v.01" }], ["path", { d: "M10 16v.01" }], ["path", { d: "M13 13v.01" }], ["path", { d: "M16 10v.01" }], ["path", { d: "M11 20v.01" }], ["path", { d: "M17 14v.01" }], ["path", { d: "M20 11v.01" }]],
  smokeSauna: [["path", { d: "M2.5 13 12 7l9.5 6" }], ["path", { d: "M4.5 12v9h15v-9" }], ["path", { d: "M10 21v-5h4v5" }], ["path", { d: "M2 21h20" }], ["path", { d: "M8 6c-1.2-1 1-2 0-3s1-2 0-3" }], ["path", { d: "M12.5 5.5c-1-.8 1-1.6 0-2.5" }], ["path", { d: "M16.5 7.5c-1.2-1 1-2 0-3s1-2 0-3" }]],
  snowflake: [["path", { d: "m10 20-1.25-2.5L6 18" }], ["path", { d: "M10 4 8.75 6.5 6 6" }], ["path", { d: "m14 20 1.25-2.5L18 18" }], ["path", { d: "m14 4 1.25 2.5L18 6" }], ["path", { d: "m17 21-3-6h-4" }], ["path", { d: "m17 3-3 6 1.5 3" }], ["path", { d: "M2 12h6.5L10 9" }], ["path", { d: "m20 10-1.5 2 1.5 2" }], ["path", { d: "M22 12h-6.5L14 15" }], ["path", { d: "m4 10 1.5 2L4 14" }], ["path", { d: "m7 21 3-6-1.5-3" }], ["path", { d: "m7 3 3 6h4" }]],
  "solar-panel": [["path", { d: "M11 2h2" }], ["path", { d: "m14.28 14-4.56 8" }], ["path", { d: "m21 22-1.558-4H4.558" }], ["path", { d: "M3 10v2" }], ["path", { d: "M6.245 15.04A2 2 0 0 1 8 14h12a1 1 0 0 1 .864 1.505l-3.11 5.457A2 2 0 0 1 16 22H4a1 1 0 0 1-.863-1.506z" }], ["path", { d: "M7 2a4 4 0 0 1-4 4" }], ["path", { d: "m8.66 7.66 1.41 1.41" }]],
  "square-parking": [["path", { d: "M9 12h4a2 2 0 0 0 0-4H9.5a.5.5 0 0 0-.5.5V16" }], ["rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }]],
  stepFree: [["path", { d: "M2 20 20 12v8Z" }], ["path", { d: "M2 20h20" }], ["path", { d: "M20 12V4" }], ["path", { d: "M20 4h-6v8" }], ["path", { d: "M4.5 13.5 11 10.5" }], ["path", { d: "m8.3 9.6 2.7.9-1 2.6" }]],
  stove: [["rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }], ["circle", { cx: 8, cy: 12, r: 3.5 }], ["circle", { cx: 8, cy: 12, r: 1 }], ["circle", { cx: 16, cy: 12, r: 3.5 }], ["circle", { cx: 16, cy: 12, r: 1 }]],
  toilet: [["path", { d: "M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18" }], ["path", { d: "M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8" }]],
  "towel-rack": [["path", { d: "M22 7h-2" }], ["path", { d: "M6.5 3h11A2.5 2.5 0 0 1 20 5.5V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5.5a1 1 0 0 0-5 0V17a1 1 0 0 0 1 1h4" }], ["path", { d: "M9 7H2" }]],
  "toy-brick": [["rect", { width: 18, height: 12, x: 3, y: 8, rx: 1 }], ["path", { d: "M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3" }], ["path", { d: "M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3" }]],
  tumbleDryer: [["rect", { x: 3, y: 2, width: 18, height: 20, rx: 2 }], ["path", { d: "M3 6.5h18" }], ["path", { d: "M6.5 4.2h.01" }], ["path", { d: "M9.5 4.2h.01" }], ["circle", { cx: 12, cy: 14, r: 5 }], ["path", { d: "M9.5 13q1.25 1 2.5 0t2.5 0" }], ["path", { d: "M9.5 15.5q1.25 1 2.5 0t2.5 0" }]],
  tv: [["path", { d: "m17 2-5 5-5-5" }], ["rect", { width: 20, height: 15, x: 2, y: 7, rx: 2 }]],
  utensils: [["path", { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" }], ["path", { d: "M7 2v20" }], ["path", { d: "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" }]],
  "washing-machine": [["path", { d: "M3 6h3" }], ["path", { d: "M17 6h.01" }], ["rect", { width: 18, height: 20, x: 3, y: 2, rx: 2 }], ["circle", { cx: 12, cy: 13, r: 5 }], ["path", { d: "M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5" }]],
  waterAccess: [["path", { d: "M4.5 15c0-4 .3-7 1.5-10" }], ["path", { d: "M8 15V4.5" }], ["path", { d: "M11.5 15c0-3-.6-5.5-2-7.5" }], ["path", { d: "M14 12.5q2 1.6 4 0t4 0" }], ["path", { d: "M2 18q2.5 2 5 0t5 0t5 0t5 0" }]],
  waves: [["path", { d: "M2 12q2.5 2 5 0t5 0 5 0 5 0" }], ["path", { d: "M2 19q2.5 2 5 0t5 0 5 0 5 0" }], ["path", { d: "M2 5q2.5 2 5 0t5 0 5 0 5 0" }]],
  "waves-ladder": [["path", { d: "M19 5a2 2 0 0 0-2 2v11" }], ["path", { d: "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" }], ["path", { d: "M7 13h10" }], ["path", { d: "M7 9h10" }], ["path", { d: "M9 5a2 2 0 0 0-2 2v11" }]],
  wifi: [["path", { d: "M12 20h.01" }], ["path", { d: "M2 8.82a15 15 0 0 1 20 0" }], ["path", { d: "M5 12.859a10 10 0 0 1 14 0" }], ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0" }]],
  woodSauna: [["rect", { x: 5, y: 11, width: 14, height: 11, rx: 1.5 }], ["circle", { cx: 8.5, cy: 9, r: 1.6 }], ["circle", { cx: 12, cy: 8.5, r: 1.6 }], ["circle", { cx: 15.5, cy: 9, r: 1.6 }], ["path", { d: "M9 22v-4.5a3 3 0 0 1 6 0V22" }], ["path", { d: "M8.5 5.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }], ["path", { d: "M12 5c-1-.8 1-1.6 0-2.5" }], ["path", { d: "M15.5 5.5c-1-.8 1-1.6 0-2.5s1-1.7 0-2.5" }]],
  zap: [["path", { d: "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" }]],
  "zap-off": [["path", { d: "M10.768 5.111 13.44 2.44a1.5 1.5 0 012.474 1.561l-1.633 4.625" }], ["path", { d: "m18.889 13.232.672-.672A1.5 1.5 0 0018.5 10h-2.844" }], ["path", { d: "m2 2 20 20" }], ["path", { d: "m7.94 7.94-3.5 3.499A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l5.5-5.5" }]],
} as const satisfies Record<string, IconNode>;

export type GlyphName = keyof typeof GLYPHS;

/** Every amenity's icon. Lucide names are kebab-case; Rantio's own are named after the amenity. */
export const AMENITY_ICONS = {
  instantBook: "zap",
  freeCancellation: "calendar-check",
  sea: "waves",
  lake: "lake",
  river: "river",
  pond: "pond",
  privateShore: "privateShore",
  sharedShore: "sharedShore",
  shoreAccess: "footprints",
  waterAccess: "waterAccess",
  jetty: "jetty",
  fridge: "refrigerator",
  freezer: "snowflake",
  cooking: "cooking-pot",
  stove: "stove",
  oven: "oven",
  microwave: "microwave",
  dishwasher: "dishwasher",
  coffeeMaker: "coffee",
  grillHut: "grillHut",
  barbecue: "barbecue",
  outdoorDining: "utensils",
  woodSauna: "woodSauna",
  electricSauna: "electricSauna",
  smokeSauna: "smokeSauna",
  hotTub: "hotTub",
  jacuzzi: "jacuzzi",
  outdoorJacuzzi: "outdoorJacuzzi",
  pool: "waves-ladder",
  boat: "boat",
  canoe: "kayak",
  fishingGear: "fishing-rod",
  internet: "wifi",
  tv: "tv",
  fireplace: "brick-wall-fire",
  heatPump: "heatPump",
  airConditioning: "air-vent",
  shower: "shower-head",
  indoorWc: "toilet",
  outdoorWc: "outdoorWc",
  washingMachine: "washing-machine",
  tumbleDryer: "tumbleDryer",
  dryingCabinet: "dryingCabinet",
  loft: "loft",
  bedLinen: "bed-double",
  towels: "towel-rack",
  noElectricity: "zap-off",
  solarPower: "solar-panel",
  carriedWater: "carriedWater",
  firepit: "flame-kindling",
  firewood: "logs",
  terrace: "rocking-chair",
  balcony: "balcony",
  garden: "flower-2",
  nearSki: "mountain-snow",
  parking: "square-parking",
  privateParking: "car-front",
  evCharging: "ev-charger",
  babyBed: "babyBed",
  highChair: "highChair",
  toys: "toy-brick",
  stairGates: "fence",
  playground: "playground",
  pets: "paw-print",
  wheelchair: "accessibility",
  stepFree: "stepFree",
  accessibleBathroom: "accessibleBathroom",
  accessibleParking: "accessibleParking",
  smokeAlarm: "alarm-smoke",
  coAlarm: "coAlarm",
  fireExtinguisher: "fire-extinguisher",
  firstAid: "briefcase-medical",
} as const satisfies Record<AmenityKey, GlyphName>;

/** Shown for a key with no icon yet (an amenity added on the server first): neutral, never a tick. */
export const FALLBACK_ICON: GlyphName = "circle-dot";

const warned = new Set<string>();

/** The drawing for an amenity key; unknown keys get the neutral fallback (and a warning while developing). */
export function amenityIcon(key: string): IconNode {
  const name = (AMENITY_ICONS as Record<string, GlyphName>)[key];
  if (name) return GLYPHS[name];
  if (process.env.NODE_ENV !== "production" && !warned.has(key)) {
    warned.add(key);
    console.warn(`[amenity icons] No icon for "${key}". Add it to AMENITY_ICONS in lib/amenityIcons.ts.`);
  }
  return GLYPHS[FALLBACK_ICON];
}

export const hasAmenityIcon = (key: string) => key in AMENITY_ICONS;
