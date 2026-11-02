// Metadata shared by every page: one canonical URL per language, hreflang links to
// the same page in all the others, and x-default pointing at English.
import type { Metadata } from "next";
import { DEFAULT_LANG, LANG_INFO, type Lang, LANGS } from "./locales";

/** Where the site is served; set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rantio.fi").replace(/\/$/, "");

/** `path` is the page without its language: "" for home, "/hosts", "/cottages/x". */
export function alternates(lang: Lang, path: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of LANGS) languages[l] = `${SITE_URL}/${l}${path}`;
  languages["x-default"] = `${SITE_URL}/${DEFAULT_LANG}${path}`;
  return { canonical: `${SITE_URL}/${lang}${path}`, languages };
}

export function pageMetadata(lang: Lang, path: string, title: string, description: string, image?: string): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: alternates(lang, path),
    openGraph: {
      type: "website",
      siteName: "Rantio",
      title,
      description,
      url: `${SITE_URL}/${lang}${path}`,
      locale: LANG_INFO[lang].og,
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => LANG_INFO[l].og),
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}
