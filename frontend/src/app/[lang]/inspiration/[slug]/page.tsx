import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuidePage } from "@/components/explore/ExplorePages";
import { getMessages } from "@/i18n";
import { isLang, LANGS } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import { GUIDE_IDS, GUIDES, isGuide } from "@/lib/explore";
import { unsplash } from "@/lib/listings";

type Props = { params: Promise<{ lang: string; slug: string }> };

export function generateStaticParams() {
  return LANGS.flatMap((lang) => GUIDE_IDS.map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang) || !isGuide(slug)) return {};
  const guide = getMessages(lang).explore.guides[slug];
  return pageMetadata(lang, `/inspiration/${slug}`, `${guide.title} | Rantio`, guide.lead, unsplash(GUIDES[slug].photo, 1200, 630));
}

async function Guide({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLang(lang) || !isGuide(slug)) notFound();
  return <GuidePage lang={lang} id={slug} />;
}

// Every guide is prerendered from generateStaticParams; as on the cottage pages, the
// boundary keeps client-side navigation instant while the guide's id is read.
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Guide params={params} />
    </Suspense>
  );
}
