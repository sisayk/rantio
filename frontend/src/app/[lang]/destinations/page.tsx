import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DestinationsPage } from "@/components/explore/ExplorePages";
import { getMessages } from "@/i18n";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { destination } from "@/lib/explore";
import { unsplash } from "@/lib/listings";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).explore.destinations.meta;
  const photo = destination("NO").photo;
  return pageMetadata(lang, "/destinations", t.title, t.description, photo ? unsplash(photo, 1200, 630) : undefined);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <DestinationsPage lang={lang} />;
}
