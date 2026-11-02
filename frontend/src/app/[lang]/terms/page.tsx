import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { isLang } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { getLegal } from "@/lib/legal";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getLegal(lang).terms;
  return pageMetadata(lang, "/terms", `${t.title} | Rantio`, t.description);
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalPage lang={lang} kind="terms" />;
}
