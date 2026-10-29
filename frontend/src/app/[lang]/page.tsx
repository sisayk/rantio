import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuestHome from "@/components/guest/GuestHome";
import { getMessages } from "@/i18n";
import { countryName, languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { COUNTRIES, type Country, HERO_PHOTO } from "@/lib/listings";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).guest.meta;
  return pageMetadata(lang, "", t.title, t.description, HERO_PHOTO);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  // Only this language's words go to the browser.
  const countries = Object.fromEntries(COUNTRIES.map((c) => [c, countryName(lang, c)])) as Record<Country, string>;
  return (
    <GuestHome lang={lang} t={m.guest} catalog={m.catalog} names={m.listingNames} common={m.common}
      countries={countries}
      languages={languageNamesIn(lang)}
    />
  );
}
