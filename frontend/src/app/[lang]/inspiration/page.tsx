import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InspirationPage } from "@/components/explore/ExplorePages";
import { getMessages } from "@/i18n";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { GUIDES } from "@/lib/explore";
import { unsplash } from "@/lib/listings";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).explore.inspiration.meta;
  return pageMetadata(lang, "/inspiration", t.title, t.description, unsplash(GUIDES.sauna.photo, 1200, 630));
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <InspirationPage lang={lang} />;
}
