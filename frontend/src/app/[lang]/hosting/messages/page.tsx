import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LanguageButton from "@/components/LanguagePicker";
import OwnerInbox from "@/components/owner/OwnerInbox";
import styles from "@/components/owner/owner.module.css";
import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).dashboard;
  return { title: `${t.inbox.title} – Stugora`, robots: { index: false, follow: false } };
}

// Conversations load in the browser after sign-in; the server only sends the words.
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <OwnerInbox
      lang={lang}
      t={m.dashboard}
      units={m.guest.units}
      languageButton={
        <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />
      }
    />
  );
}
