/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Localization tests. In a normal terminal:  cd ~/stugora/frontend && npm run test:i18n
require("./ts-hook.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { findGaps, getMessages } = require("../src/i18n/index.ts");
const { countryName, fill, money, number, plural, pluralCategory } = require("../src/i18n/format.ts");
const { LANG_INFO, LANGS, negotiateLang } = require("../src/i18n/locales.ts");
const { stripLang, switchLangPath } = require("../src/i18n/paths.ts");
const { activitiesFor } = require("../src/lib/activities.ts");
const { FEATURE_GROUPS } = require("../src/lib/catalog.ts");
const { LISTINGS } = require("../src/lib/listings.ts");
const { cityNames, regionLabel } = require("../src/lib/placeNames.ts");
const { PLACES } = require("../src/lib/places.ts");

test("ten languages, English first and as the default", () => {
  assert.deepEqual([...LANGS], ["en", "fi", "sv", "nb", "nn", "da", "is", "et", "lv", "lt"]);
  for (const lang of LANGS) assert.ok(LANG_INFO[lang].native.length > 1, lang);
});

test("every language is complete: keys, plural forms, lists and placeholders", () => {
  for (const lang of LANGS) assert.deepEqual(findGaps(lang), [], `${lang} has gaps`);
});

test("browser languages map to ours, best match first, English otherwise", () => {
  assert.equal(negotiateLang(null), "en");
  assert.equal(negotiateLang("de-DE,de;q=0.9"), "en");
  assert.equal(negotiateLang("fi-FI,fi;q=0.9,en;q=0.8"), "fi");
  assert.equal(negotiateLang("sv-FI"), "sv");
  assert.equal(negotiateLang("no"), "nb");
  assert.equal(negotiateLang("nb-NO"), "nb");
  assert.equal(negotiateLang("nn"), "nn");
  assert.equal(negotiateLang("de;q=1, lt;q=0.5, et;q=0.7"), "et");
  assert.equal(negotiateLang("en;q=0, lv"), "lv");
});

test("switching language keeps the page", () => {
  assert.equal(switchLangPath("/fi/cottages/lakeside-villa", "et"), "/et/cottages/lakeside-villa");
  assert.equal(switchLangPath("/en", "lt"), "/lt");
  assert.equal(switchLangPath("/sv/hosts/", "da"), "/da/hosts");
  assert.equal(switchLangPath("/", "is"), "/is");
  assert.equal(stripLang("/nn/hosts"), "/hosts");
});

test("plural forms follow each language's rules", () => {
  const lt = getMessages("lt").guest.units.guests;
  assert.notEqual(plural("lt", lt, 1), plural("lt", lt, 2));
  assert.notEqual(plural("lt", lt, 2), plural("lt", lt, 10));
  assert.equal(plural("lt", lt, 21).replace("21", "1"), plural("lt", lt, 1));
  const lv = getMessages("lv").guest.units.nights;
  assert.notEqual(plural("lv", lv, 0), plural("lv", lv, 1).replace("1", "0"));
  const is = getMessages("is").guest.units.guests;
  assert.equal(plural("is", is, 21).replace("21", "1"), plural("is", is, 1));
  assert.equal(plural("fi", getMessages("fi").guest.units.cottages, 3), "3 mökkiä");
  assert.equal(plural("en", getMessages("en").guest.units.cottages, 1), "1 cottage");
});

test("our plural rules agree with CLDR for every whole number up to 1000", () => {
  for (const lang of LANGS) {
    const rules = new Intl.PluralRules(LANG_INFO[lang].intl);
    for (let n = 0; n <= 1000; n++) assert.equal(pluralCategory(lang, n), rules.select(n), `${lang} ${n}`);
  }
});

test("numbers and prices are written the local way, identically on server and browser", () => {
  const nbsp = "\u00a0";
  assert.equal(money("en", 180), "€180");
  assert.equal(money("en", 2040), "€2,040");
  assert.equal(money("fi", 1500), `1${nbsp}500${nbsp}€`);
  assert.equal(money("da", 2040), `2.040${nbsp}€`);
  assert.equal(money("lv", 2040), `2040${nbsp}€`);
  assert.equal(money("lv", 12040), `12${nbsp}040${nbsp}€`);
  assert.equal(number("fi", 4.6, { min: 1, max: 1 }), "4,6");
  assert.equal(number("en", 4, { min: 1, max: 1 }), "4.0");
  assert.equal(number("sv", 3.25, { max: 1 }), "3,3");
  assert.equal(number("is", 12, { max: 1 }), "12");
  assert.equal(fill("fi", "{n} yötä", { n: 2 }), "2 yötä");
  assert.equal(countryName("fi", "SE"), "Ruotsi");
  assert.equal(countryName("et", "FI"), "Soome");
});

test("missing text falls back to English, word by word", () => {
  const { withFallback } = require("../src/i18n/index.ts");
  const en = getMessages("en");
  const partial = withFallback({ guest: { hero: { title: "Hitta stugan" }, units: { guests: { one: "{n} gäst", other: "{n} gäster" } } } });
  assert.equal(partial.guest.hero.title, "Hitta stugan");
  assert.equal(partial.guest.hero.lead, en.guest.hero.lead);
  assert.equal(partial.owner.form.submit, en.owner.form.submit);
  assert.equal(plural("sv", partial.guest.units.guests, 2), "2 gäster");
});

test("every text the pages show exists in every language", () => {
  for (const lang of LANGS) {
    const m = getMessages(lang);
    for (const g of FEATURE_GROUPS) {
      assert.ok(m.catalog.groups[g.id], `${lang} group ${g.id}`);
      for (const k of g.options) assert.ok(m.catalog.features[k], `${lang} feature ${k}`);
    }
    for (const l of LISTINGS) {
      assert.ok(m.listingNames[l.id], `${lang} name of ${l.id}`);
      for (const a of activitiesFor(l, m.activities)) {
        assert.ok(a.title && a.body, `${lang} ${l.id} ${a.id}`);
        assert.doesNotMatch(a.body, /\{\w+\}/, `${lang} ${l.id} ${a.id} left a placeholder`);
      }
    }
  }
});

test("towns are found by their other names; listings stay in every country", () => {
  assert.ok(cityNames("Helsinki").includes("Helsingfors"));
  assert.ok(cityNames("Turku").includes("Åbo"));
  assert.ok(cityNames("Tallinn").includes("Tallinna"));
  assert.ok(cityNames("Copenhagen").includes("København"));
  assert.ok(cityNames("Gothenburg").includes("Göteborg"));
  const countries = new Set(LISTINGS.map((l) => l.country));
  for (const c of ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"]) assert.ok(countries.has(c), c);
});

test("regions use the local name where the language is spoken", () => {
  const nordland = PLACES.NO.find((r) => r.id === "nordland");
  const stockholm = PLACES.SE.find((r) => r.id === "stockholm");
  assert.equal(regionLabel(stockholm, "SE", "sv"), "Stockholms län");
  assert.equal(regionLabel(stockholm, "SE", "fi"), stockholm.name.fi);
  assert.equal(regionLabel(stockholm, "SE", "et"), "Stockholm County");
  assert.equal(regionLabel(nordland, "NO", "nn"), nordland.name.local);
});
