// The languages Rantio speaks. Adding one means adding its code here, its row in
// LANG_INFO and a messages file; routes, the picker, sitemaps and hreflang follow.
// Nothing here depends on the rest of the app, so the proxy can import it too.

export const LANGS = ["en", "fi", "sv", "nb", "nn", "da", "is", "et", "lv", "lt", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** International default and the fallback for any text a language is missing. */
export const DEFAULT_LANG: Lang = "en";

/** Set only when someone picks a language, so a shared link never overrides their choice. */
export const LANG_COOKIE = "stugora_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type LangInfo = {
  /** Name in the language itself, as shown in the picker. */
  native: string;
  /** BCP 47 tag for numbers, dates, currency and plural rules. */
  intl: string;
  /** Wikipedia edition for places near a cottage. */
  wiki: string;
  /** Open Graph locale. */
  og: string;
};

export const LANG_INFO: Record<Lang, LangInfo> = {
  en: { native: "English", intl: "en-IE", wiki: "en", og: "en_GB" },
  fi: { native: "Suomi", intl: "fi-FI", wiki: "fi", og: "fi_FI" },
  sv: { native: "Svenska", intl: "sv-SE", wiki: "sv", og: "sv_SE" },
  nb: { native: "Norsk bokmål", intl: "nb-NO", wiki: "no", og: "nb_NO" },
  nn: { native: "Norsk nynorsk", intl: "nn-NO", wiki: "nn", og: "nn_NO" },
  da: { native: "Dansk", intl: "da-DK", wiki: "da", og: "da_DK" },
  is: { native: "Íslenska", intl: "is-IS", wiki: "is", og: "is_IS" },
  et: { native: "Eesti", intl: "et-EE", wiki: "et", og: "et_EE" },
  lv: { native: "Latviešu", intl: "lv-LV", wiki: "lv", og: "lv_LV" },
  lt: { native: "Lietuvių", intl: "lt-LT", wiki: "lt", og: "lt_LT" },
  de: { native: "Deutsch", intl: "de-DE", wiki: "de", og: "de_DE" },
};

/** Languages people speak in each country Rantio covers, used for local place names. */
export const COUNTRY_LANGS: Record<string, readonly Lang[]> = {
  FI: ["fi", "sv"],
  SE: ["sv"],
  NO: ["nb", "nn"],
  DK: ["da"],
  IS: ["is"],
  EE: ["et"],
  LV: ["lv"],
  LT: ["lt"],
};

export const isLang = (value: unknown): value is Lang =>
  typeof value === "string" && (LANGS as readonly string[]).includes(value);

/** Browser language tags that mean one of ours: "no" is written as Bokmål. */
function toLang(tag: string): Lang | null {
  const [primary, second] = tag.toLowerCase().trim().split(/[-_]/);
  if (primary === "no") return second === "nn" ? "nn" : "nb";
  return isLang(primary) ? primary : null;
}

/** Accept-Language's tags, most wanted first. */
function rankedTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((x) => x.tag);
}

/** The best of our languages for an Accept-Language header, or English. */
export function negotiateLang(header: string | null | undefined): Lang {
  for (const tag of rankedTags(header)) {
    const lang = toLang(tag);
    if (lang) return lang;
  }
  return DEFAULT_LANG;
}

/**
 * The language a visitor without a saved choice sees first.
 *
 * - Their browser's first language, when it's one of ours other than English
 *   (a Swedish-speaking Finn gets Swedish, an Estonian in Helsinki Estonian).
 * - Otherwise, if the browser is in English (or says nothing), the country they're in:
 *   in Finland Finnish, in Sweden Swedish… Many locals leave their browser in English.
 * - Otherwise (a German browser, say: probably a visitor) the best match, else English.
 */
export function firstLang(header: string | null | undefined, country: string | null | undefined): Lang {
  const top = rankedTags(header)[0];
  const topLang = top ? toLang(top) : null;
  if (topLang && topLang !== DEFAULT_LANG) return topLang;
  const local = country ? COUNTRY_LANGS[country.toUpperCase()]?.[0] : undefined;
  if (local && (!top || topLang === DEFAULT_LANG)) return local;
  return negotiateLang(header);
}
