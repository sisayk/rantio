// Privacy policy and website terms. Kept out of src/i18n/messages on purpose: they
// exist in English and Finnish only, and every other language shows the English text.
import type { Lang } from "@/i18n/locales";
import { en } from "./en";
import { fi } from "./fi";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  /** Shown after the paragraphs. */
  list?: string[];
};

export type LegalPage = {
  title: string;
  /** For search results and link previews. */
  description: string;
  /** "Last updated: …", shown under the title. */
  updated: string;
  intro: string;
  sections: LegalSection[];
};

/** deletion: how to delete an account (the page the app stores link to; Google Play asks for one). */
export type LegalTexts = { privacy: LegalPage; terms: LegalPage; deletion: LegalPage };
export type LegalKind = keyof LegalTexts;

const TEXTS: Partial<Record<Lang, LegalTexts>> = { en, fi };

/** Shown above the English text on pages in the other languages. */
export const OTHER_LANGUAGE_NOTE = "This page is available in English and Finnish.";

/** The language the legal text is actually written in for a page language. */
export const legalLang = (lang: Lang): Lang => (TEXTS[lang] ? lang : "en");

export const getLegal = (lang: Lang): LegalTexts => TEXTS[legalLang(lang)] ?? en;
