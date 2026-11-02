import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LanguageButton from "@/components/LanguagePicker";
import OwnerListings from "@/components/owner/OwnerListings";
import styles from "@/components/owner/owner.module.css";
import { getMessages } from "@/i18n";
import { countryName, languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { COUNTRIES } from "@/lib/listings";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${getMessages(lang).listings.meta.title} – Rantio`, robots: { index: false, follow: false } };
}

// The owner's properties load in the browser after sign-in; the server only sends the words.
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <OwnerListings
      lang={lang}
      t={m.dashboard}
      l={m.listings}
      countries={Object.fromEntries(COUNTRIES.map((c) => [c, countryName(lang, c)]))}
      languageButton={<LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />}
    />
  );
}
