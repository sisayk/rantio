// The website's words in the app. Everything comes from frontend/src/i18n, so a fix
// to a translation there reaches the site and both apps.
import { getLocales } from "expo-localization";
import { useMemo } from "react";

import { fill, number, plural, type Plural } from "@/i18n/format";
import { getMessages, type Messages } from "@/i18n/index";
import { COUNTRY_LANGS, DEFAULT_LANG, isLang, LANG_INFO, type Lang, LANGS } from "@/i18n/locales";
import { usePrefs } from "@/state/prefs";
import { NAMES } from "@/text/names";

export { LANG_INFO, LANGS, type Lang, type Messages };

/** The phone's own language if Stugora speaks it (Norwegian "no" counts as bokmål). */
export function deviceLang(): Lang {
  for (const loc of getLocales()) {
    const code = (loc.languageCode ?? "").toLowerCase();
    if (isLang(code)) return code;
    if (code === "no" || code === "nb") return "nb";
  }
  // A phone set to a country we cover but a language we don't: that country's language.
  const region = getLocales()[0]?.regionCode ?? "";
  return COUNTRY_LANGS[region]?.[0] ?? DEFAULT_LANG;
}

export function useT() {
  const { lang } = usePrefs();
  return useMemo(() => {
    const m = getMessages(lang);
    const names = NAMES[lang];
    return {
      lang,
      m,
      /** Fills {placeholders}; numbers are written the language's way. */
      f: (template: string, vars: Record<string, string | number> = {}) => fill(lang, template, vars),
      /** The right plural form for n. */
      p: (forms: Plural, n: number, vars: Record<string, string | number> = {}) => plural(lang, forms, n, vars),
      n: (value: number) => number(lang, value),
      country: (code: string) => (names.country as Record<string, string>)[code] ?? code,
      language: (code: string) => (names.language as Record<string, string>)[code] ?? code,
      currencyName: (code: string) => (names.currency as Record<string, string>)[code] ?? code,
      native: (code: Lang) => LANG_INFO[code].native,
    };
  }, [lang]);
}

export type T = ReturnType<typeof useT>;
