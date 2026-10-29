import { type NextRequest, NextResponse } from "next/server";
import { isLang, LANG_COOKIE, negotiateLang } from "./i18n/locales";

// Any address without a language (/, /hosts, /cottages/x) goes to the same page in
// the visitor's language: the one they picked before, else their browser's, else English.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // next.config.ts turns off Next's own trailing-slash redirect for the API's sake,
  // so pages trim it here: /fi/hosts/ → /fi/hosts.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    // A plain URL: Next's own URL object would put the trailing slash back.
    const url = new URL(pathname.replace(/\/+$/, "") + request.nextUrl.search, request.url);
    return NextResponse.redirect(url, 308);
  }
  if (isLang(pathname.split("/")[1])) return NextResponse.next();

  const saved = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(saved) ? saved : negotiateLang(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Not for Next.js internals, the API, sitemaps, robots.txt or files such as favicon.ico.
  matcher: ["/((?!_next|api|sitemap|robots\\.txt|.*\\..*).*)"],
};
