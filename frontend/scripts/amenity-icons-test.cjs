/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Amenity icon tests. In a normal terminal:  cd ~/stugora/frontend && npm run test:icons
require("./ts-hook.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { AMENITY_ICONS, FALLBACK_ICON, amenityIcon, hasAmenityIcon } = require("../src/lib/amenityIcons.ts");
const { AMENITY_GROUPS, EDITOR_AMENITIES, amenityName } = require("../src/lib/amenities.ts");
const { FEATURE_GROUPS } = require("../src/lib/catalog.ts");
const { LISTINGS } = require("../src/lib/listings.ts");
const { getMessages } = require("../src/i18n/index.ts");
const { LANGS } = require("../src/i18n/locales.ts");
const AmenityIcon = require("../src/components/AmenityIcon.tsx").default;

const featureKeys = FEATURE_GROUPS.flatMap((g) => g.options);
const allKeys = [...new Set([...featureKeys, ...EDITOR_AMENITIES])];
const TAGS = new Set(["path", "circle", "rect", "line", "polyline", "ellipse", "polygon"]);

test("every amenity the site and the editor know has its own icon", () => {
  for (const k of allKeys) assert.ok(hasAmenityIcon(k), `${k} has no icon`);
  for (const g of AMENITY_GROUPS) for (const k of g.keys) assert.ok(hasAmenityIcon(k), `${k} (editor) has no icon`);
  assert.deepEqual(Object.keys(AMENITY_ICONS).sort(), [...allKeys].sort(), "the registry lists exactly the known amenities");
});

test("the registry covers every key the server accepts", () => {
  const py = fs.readFileSync(path.resolve(__dirname, "../../backend/owners/listings.py"), "utf8");
  const block = (name) => py.slice(py.indexOf(`${name} =`), py.indexOf("}", py.indexOf(`${name} =`)) + 1);
  const keys = [...["WATER", "SAUNAS", "FILTER_KEYS", "EDITOR_KEYS"].map(block).join("\n").matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 60, `found only ${keys.length} server keys`);
  for (const k of keys) assert.ok(hasAmenityIcon(k), `server key ${k} has no icon`);
});

test("no two amenities share an icon", () => {
  const seen = new Map();
  for (const [k, glyph] of Object.entries(AMENITY_ICONS)) {
    assert.ok(!seen.has(glyph), `${k} and ${seen.get(glyph)} both use ${glyph}`);
    seen.set(glyph, k);
  }
  assert.ok(!seen.has(FALLBACK_ICON), "the fallback is not any amenity's icon");
});

test("every icon is a clean 24×24 outline drawing", () => {
  for (const k of [...allKeys, "unknown"]) {
    const nodes = amenityIcon(k);
    assert.ok(nodes.length > 0, k);
    for (const [tag, attrs] of nodes) {
      assert.ok(TAGS.has(tag), `${k}: ${tag}`);
      for (const [name, v] of Object.entries(attrs)) {
        if (typeof v === "number") assert.ok(v >= 0 && v <= 24, `${k}: ${name}=${v} is off the grid`);
        assert.ok(!["fill", "stroke", "style", "class"].includes(name), `${k}: icons take colour from where they're used`);
      }
    }
  }
});

test("an unknown amenity gets the neutral fallback instead of breaking", () => {
  const warn = console.warn;
  const warnings = [];
  console.warn = (m) => warnings.push(m);
  try {
    assert.equal(amenityIcon("helicopterPad"), amenityIcon("anotherNewThing"));
    amenityIcon("helicopterPad");
    assert.equal(warnings.length, 2, "each unknown key is reported once while developing");
    assert.match(renderToStaticMarkup(createElement(AmenityIcon, { amenity: "helicopterPad" })), /^<svg[^>]*data-amenity="helicopterPad"/);
  } finally {
    console.warn = warn;
  }
});

test("the icon doesn't depend on the language: the same key, the same drawing", () => {
  const svg = renderToStaticMarkup(createElement(AmenityIcon, { amenity: "woodSauna" }));
  for (const lang of LANGS) {
    const m = getMessages(lang);
    for (const k of allKeys) assert.notEqual(amenityName(k, m.catalog.features, m.listings.amenities.names), k, `${lang}: ${k} has no name`);
  }
  assert.equal(renderToStaticMarkup(createElement(AmenityIcon, { amenity: "woodSauna" })), svg);
});

test("every example cottage's amenities have icons", () => {
  for (const l of LISTINGS) for (const k of l.features) assert.ok(hasAmenityIcon(k), `${l.id}: ${k}`);
});
