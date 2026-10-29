import { type NextRequest, NextResponse } from "next/server";
import { isLang, LANG_COOKIE, negotiateLang } from "./i18n/locales";

// Any address without a language (/, /hosts, /cottages/x) goes to the same page in
// the visitor's language: the one they picked before, else their browser's, else English.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
