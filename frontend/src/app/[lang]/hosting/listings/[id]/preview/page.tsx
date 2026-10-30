import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ListingPreview from "@/components/owner/listing/ListingPreview";
import { getMessages } from "@/i18n";
import { countryName } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { COUNTRIES } from "@/lib/listings";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${getMessages(lang).listings.meta.previewTitle} – Stugora`, robots: { index: false, follow: false } };
}

async function Preview({ params }: Props) {
  const { lang, id } = await params;
  const pk = Number(id);
  if (!isLang(lang) || !Number.isInteger(pk) || pk < 1) notFound();
  const m = getMessages(lang);
  return (
    <ListingPreview
      lang={lang}
      id={pk}
      l={m.listings}
      t={m.dashboard}
      features={m.catalog.features}
      countries={Object.fromEntries(COUNTRIES.map((c) => [c, countryName(lang, c)]))}
    />
  );
}

// Owner only: the data comes from the signed-in owner's own API, so drafts and paused
// listings can be previewed without ever being public.
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Preview params={params} />
    </Suspense>
  );
}
