import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing from "@/components/Landing";
import { getMessages } from "@/i18n";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { PHOTOS } from "@/lib/showcase";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).owner.meta;
  return pageMetadata(lang, "/hosts", t.title, t.description, PHOTOS.hero.src);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <Landing lang={lang} />;
}
