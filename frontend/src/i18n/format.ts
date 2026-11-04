import { LANG_INFO, type Lang, LANGS } from "./locales";

/** Words that change with a count. Each language fills the categories its plural rules use. */
export type Plural = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);

/** A plural object has only plural-category keys, "other" among them. */
export const isPlural = (value: unknown): value is Plural =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Plural).other === "string" &&
  Object.keys(value).every((k) => PLURAL_KEYS.has(k));

type Vars = Record<string, string | number>;

/** Fills {name} placeholders; numbers are written the way the language writes them. */
export function fill(lang: Lang, template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) return match;
    return typeof value === "number" ? number(lang, value) : value;
  });
}

// Numbers, prices and plural forms are worked out here rather than with Intl:
// browsers and Node don't all carry the same locale data (some show Icelandic
// or Nynorsk prices in English style), and a page must read the same when the
// server renders it and when the browser takes over. These are the CLDR rules.

type NumberStyle = { group: string; decimal: string; minGroup: 1 | 2; euro: "before" | "after" };
const NBSP = "\u00a0";
const NUMBER_STYLE: Record<Lang, NumberStyle> = {
  en: { group: ",", decimal: ".", minGroup: 1, euro: "before" },
  fi: { group: NBSP, decimal: ",", minGroup: 1, euro: "after" },
  sv: { group: NBSP, decimal: ",", minGroup: 1, euro: "after" },
  nb: { group: NBSP, decimal: ",", minGroup: 1, euro: "after" },
  nn: { group: NBSP, decimal: ",", minGroup: 1, euro: "after" },
  da: { group: ".", decimal: ",", minGroup: 1, euro: "after" },
  is: { group: ".", decimal: ",", minGroup: 1, euro: "after" },
  et: { group: NBSP, decimal: ",", minGroup: 2, euro: "after" },
  lv: { group: NBSP, decimal: ",", minGroup: 2, euro: "after" },
  lt: { group: NBSP, decimal: ",", minGroup: 1, euro: "after" },
  de: { group: ".", decimal: ",", minGroup: 1, euro: "after" },
};

/** 1 234,5 in Finnish, 1,234.5 in English; `fraction` fixes the decimals shown. */
export function number(lang: Lang, n: number, fraction?: { min?: number; max?: number }): string {
  const style = NUMBER_STYLE[lang];
  const max = fraction?.max ?? fraction?.min ?? 0;
  const min = fraction?.min ?? 0;
  const fixed = Math.abs(n).toFixed(max);
  let [whole, part = ""] = fixed.split(".");
  while (part.length > min && part.endsWith("0")) part = part.slice(0, -1);
  if (whole.length > 3 && whole.length >= 4 + style.minGroup - 1) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  return `${n < 0 ? "−" : ""}${whole}${part ? style.decimal + part : ""}`;
}

/** Whole euros, written for the language: "€180" in English, "180 €" in the others. */
export function money(lang: Lang, amount: number): string {
  const n = number(lang, Math.round(amount));
  return NUMBER_STYLE[lang].euro === "before" ? `€${n}` : `${n}${NBSP}€`;
}

type Category = keyof Plural;
const mod = (n: number, m: number) => n % m;

/** CLDR plural category of a whole number. */
export function pluralCategory(lang: Lang, n: number): Category {
  const i = Math.abs(Math.trunc(n));
  if (i !== Math.abs(n)) return lang === "lt" ? "many" : "other";
  const d10 = mod(i, 10);
  const d100 = mod(i, 100);
  switch (lang) {
    case "is":
      return d10 === 1 && d100 !== 11 ? "one" : "other";
    case "lv":
      if (d10 === 0 || (d100 >= 11 && d100 <= 19)) return "zero";
      return d10 === 1 && d100 !== 11 ? "one" : "other";
    case "lt":
      if (d100 >= 11 && d100 <= 19) return "other";
      if (d10 === 1) return "one";
      return d10 >= 2 ? "few" : "other";
    default:
      return i === 1 ? "one" : "other";
  }
}

/** Picks the right form for n ("1 vieras", "3 vierasta"); {n} is the count. */
export function plural(lang: Lang, forms: Plural, n: number, vars: Vars = {}): string {
  const form = forms[pluralCategory(lang, n)] ?? forms.other;
  return fill(lang, form, { n, ...vars });
}

const countryNames = new Map<Lang, Intl.DisplayNames>();

/** A country's name in the language, from Node's CLDR data. Call it on the server
 *  and pass the result to client components (see app/[lang]/page.tsx). */
export function countryName(lang: Lang, code: string): string {
  let names = countryNames.get(lang);
  if (!names) {
    names = new Intl.DisplayNames([LANG_INFO[lang].intl], { type: "region" });
    countryNames.set(lang, names);
  }
  return names.of(code) ?? code;
}

const languageNames = new Map<Lang, Intl.DisplayNames>();

/** A language's name as written in another language: languageName("fi", "sv") → "ruotsi". */
export function languageName(inLang: Lang, code: string): string {
  let names = languageNames.get(inLang);
  if (!names) {
    names = new Intl.DisplayNames([LANG_INFO[inLang].intl], { type: "language" });
    languageNames.set(inLang, names);
  }
  return names.of(code) ?? code;
}

/** Every one of our languages named in `inLang`, plus English, for the language picker. */
export function languageNamesIn(inLang: Lang): Record<Lang, { local: string; english: string }> {
  return Object.fromEntries(
    LANGS.map((code) => [code, { local: languageName(inLang, code), english: languageName("en", code) }]),
  ) as Record<Lang, { local: string; english: string }>;
}

const currencyDisplay = new Map<Lang, Intl.DisplayNames>();

/** Currency names in the language ("Swedish krona", "ruotsin kruunu"); call on the server
 *  and pass the result to client components, like countryName. */
export function currencyName(lang: Lang, code: string): string {
  let names = currencyDisplay.get(lang);
  if (!names) {
    names = new Intl.DisplayNames([LANG_INFO[lang].intl], { type: "currency" });
    currencyDisplay.set(lang, names);
  }
  const name = names.of(code) ?? code;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The site's currencies by name in the language, for the currency picker. */
export function currencyNames(lang: Lang): Record<"EUR" | "SEK" | "NOK" | "DKK" | "ISK", string> {
  const codes = ["EUR", "SEK", "NOK", "DKK", "ISK"] as const;
  return Object.fromEntries(codes.map((c) => [c, currencyName(lang, c)])) as Record<(typeof codes)[number], string>;
}
