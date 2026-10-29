import { isLang, type Lang } from "./locales";

// Every page lives under its language: /en, /fi/hosts, /sv/cottages/lakeside-villa.
export const paths = {
  home: (lang: Lang) => `/${lang}`,
  hosts: (lang: Lang) => `/${lang}/hosts`,
  cottage: (lang: Lang, id: string) => `/${lang}/cottages/${id}`,
  hosting: (lang: Lang) => `/${lang}/hosting`,
  hostingLogin: (lang: Lang) => `/${lang}/hosting/login`,
  hostingMessages: (lang: Lang) => `/${lang}/hosting/messages`,
  /** A guest's private conversation page; the token is its only key. */
  guestChat: (lang: Lang, token: string) => `/${lang}/messages/${token}`,
  privacy: (lang: Lang) => `/${lang}/privacy`,
  terms: (lang: Lang) => `/${lang}/terms`,
};

/** The same page in another language: swaps the first path segment. */
export function switchLangPath(pathname: string, to: Lang): string {
  const parts = pathname.split("/");
  if (isLang(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  const next = parts.join("/").replace(/\/+$/, "");
  return next || `/${to}`;
}

/** Path without its language, for building hreflang alternates: "/fi/hosts" → "/hosts". */
export function stripLang(pathname: string): string {
  const parts = pathname.split("/");
  if (isLang(parts[1])) parts.splice(1, 1);
  return parts.join("/") || "/";
}
