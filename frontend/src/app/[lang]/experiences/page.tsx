import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperiencesPage } from "@/components/explore/ExplorePages";
import { getMessages } from "@/i18n";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { EXPERIENCES } from "@/lib/explore";
import { unsplash } from "@/lib/listings";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).explore.experiences.meta;
  return pageMetadata(lang, "/experiences", t.title, t.description, unsplash(EXPERIENCES.sauna.photo, 1200, 630));
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ExperiencesPage lang={lang} />;
}
