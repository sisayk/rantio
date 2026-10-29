import type { MetadataRoute } from "next";
import { LANGS } from "@/i18n/locales";
import { SITE_URL } from "@/i18n/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: LANGS.map((lang) => `${SITE_URL}/sitemap/${lang}.xml`),
  };
}
