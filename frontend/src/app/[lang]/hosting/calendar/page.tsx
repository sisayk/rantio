import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LanguageButton from "@/components/LanguagePicker";
import OwnerCalendar from "@/components/owner/OwnerCalendar";
import styles from "@/components/owner/owner.module.css";
import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).dashboard;
  return { title: `${t.calendar.title} – Rantio`, robots: { index: false, follow: false } };
}

// The calendar loads in the browser after sign-in; the server only sends the words.
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <OwnerCalendar
      lang={lang}
      t={m.dashboard}
      languageButton={
        <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />
      }
    />
  );
}
