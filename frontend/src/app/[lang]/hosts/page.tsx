import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing from "@/components/Landing";
import { getMessages } from "@/i18n";
import { fill } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { YEARLY_FEES } from "@/lib/content";
import { formatPrice, LANG_CURRENCY } from "@/lib/currency";
import { PHOTOS } from "@/lib/showcase";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).owner.meta;
  const currency = LANG_CURRENCY[lang];
  const description = fill(lang, t.description, { fee: formatPrice(lang, YEARLY_FEES[currency], currency) });
  return pageMetadata(lang, "/hosts", t.title, description, PHOTOS.hero.src);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <Landing lang={lang} />;
}
