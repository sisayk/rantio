import type { MetadataRoute } from "next";
import { LANGS } from "@/i18n/locales";
import { alternates } from "@/i18n/seo";
import { LISTINGS } from "@/lib/listings";

// One sitemap per language at /sitemap/<lang>.xml, each URL listing its
// hreflang alternates; robots.txt points search engines at all of them.
export function generateSitemaps() {
  return LANGS.map((id) => ({ id }));
}

const PAGES = ["", "/hosts", ...LISTINGS.map((l) => `/cottages/${l.id}`), "/privacy", "/terms"];

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const lang = LANGS.find((l) => l === id);
  if (!lang) return [];
  return PAGES.map((path) => {
    const { canonical, languages } = alternates(lang, path);
    return {
      url: String(canonical),
      changeFrequency: path.startsWith("/cottages") ? "weekly" : path === "/privacy" || path === "/terms" ? "yearly" : "monthly",
      priority: path === "" ? 1 : path === "/hosts" ? 0.8 : path === "/privacy" || path === "/terms" ? 0.2 : 0.6,
      alternates: { languages: languages as Record<string, string> },
    };
  });
}
