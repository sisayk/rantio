// Server-side entry: pages call getMessages(lang) and hand each client component
// only the part it needs, so the browser never downloads all ten languages.
import { isPlural } from "./format";
import { DEFAULT_LANG, LANG_INFO, type Lang, LANGS } from "./locales";
import { da } from "./messages/da";
import { de } from "./messages/de";
import { en, type Messages } from "./messages/en";
import { et } from "./messages/et";
import { fi } from "./messages/fi";
import { is } from "./messages/is";
import { lt } from "./messages/lt";
import { lv } from "./messages/lv";
import { nb } from "./messages/nb";
import { nn } from "./messages/nn";
import { sv } from "./messages/sv";
import type { Translation } from "./translation";

export type { Messages };

export const TRANSLATIONS: Record<Lang, Translation> = { en, fi, sv, nb, nn, da, is, et, lv, lt, de };

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v) && !isPlural(v);

/** English with the language's own text laid over it. */
function merge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isTree(base) || !isTree(over)) return over;
  const out: Tree = { ...base };
  for (const key of Object.keys(over)) out[key] = merge(base[key], over[key]);
  return out;
}

/** A translation completed with English wherever it has nothing of its own. */
export const withFallback = (translation: Translation): Messages => merge(en, translation) as Messages;

const cache = new Map<Lang, Messages>();

export function getMessages(lang: Lang): Messages {
  let messages = cache.get(lang);
  if (!messages) {
    messages = lang === DEFAULT_LANG ? en : withFallback(TRANSLATIONS[lang]);
    cache.set(lang, messages);
  }
  return messages;
}

export type Gap = { lang: Lang; key: string; problem: "missing" | "plural" | "list" | "placeholder" | "untranslated" };

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/**
 * Everything a language is missing or has wrong compared with English: absent
 * keys, plural forms its grammar needs, list lengths and {placeholders}.
 */
export function findGaps(lang: Lang): Gap[] {
  const gaps: Gap[] = [];
  const categories = new Intl.PluralRules(LANG_INFO[lang].intl).resolvedOptions().pluralCategories;
  const walk = (base: unknown, own: unknown, key: string) => {
    if (own === undefined) {
      gaps.push({ lang, key, problem: "missing" });
      return;
    }
    if (isPlural(base)) {
      const forms = own as Record<string, string>;
      const placeholdersOk = Object.values(forms).every((f) => typeof f === "string" && placeholders(f) === placeholders(base.other));
      if (!isPlural(own) || categories.some((c) => c !== "other" && !forms[c] && !(c === "zero" && lang !== "lv")))
        gaps.push({ lang, key, problem: "plural" });
      else if (!placeholdersOk) gaps.push({ lang, key, problem: "placeholder" });
      return;
    }
    if (Array.isArray(base)) {
      if (!Array.isArray(own) || own.length !== base.length) gaps.push({ lang, key, problem: "list" });
      else base.forEach((item, i) => walk(item, own[i], `${key}[${i}]`));
      return;
    }
    if (isTree(base)) {
      if (!isTree(own)) return void gaps.push({ lang, key, problem: "missing" });
      for (const k of Object.keys(base)) walk(base[k], own[k], key ? `${key}.${k}` : k);
      return;
    }
    if (typeof base === "string" && typeof own === "string" && placeholders(base) !== placeholders(own))
      gaps.push({ lang, key, problem: "placeholder" });
  };
  if (lang !== DEFAULT_LANG) walk(en, TRANSLATIONS[lang], "");
  return gaps;
}

export const allGaps = () => LANGS.flatMap(findGaps);
