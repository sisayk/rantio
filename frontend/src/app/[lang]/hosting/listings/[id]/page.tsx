import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LanguageButton from "@/components/LanguagePicker";
import ListingEditor from "@/components/owner/listing/ListingEditor";
import styles from "@/components/owner/owner.module.css";
import { getMessages } from "@/i18n";
import { countryName, languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { COUNTRIES } from "@/lib/listings";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${getMessages(lang).listings.meta.editTitle} – Stugora`, robots: { index: false, follow: false } };
}

async function Editor({ params }: Props) {
  const { lang, id } = await params;
  const pk = Number(id);
  if (!isLang(lang) || !Number.isInteger(pk) || pk < 1) notFound();
  const m = getMessages(lang);
  return (
    <ListingEditor
      lang={lang}
      id={pk}
      t={m.dashboard}
      l={m.listings}
      features={m.catalog.features}
      countries={Object.fromEntries(COUNTRIES.map((c) => [c, countryName(lang, c)]))}
      languageButton={<LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />}
    />
  );
}

// The property id is only known per request; its data loads in the browser after sign-in.
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Editor params={params} />
    </Suspense>
  );
}
