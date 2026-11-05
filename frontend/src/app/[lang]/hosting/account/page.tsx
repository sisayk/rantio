import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LanguageButton from "@/components/LanguagePicker";
import OwnerAccount from "@/components/owner/OwnerAccount";
import styles from "@/components/owner/owner.module.css";
import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { ACCOUNT } from "@/i18n/messages/account";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${ACCOUNT[lang].profile.title} – Rantio`, robots: { index: false, follow: false } };
}

// Hosting → Account: loads in the browser after sign-in.
export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <OwnerAccount
      lang={lang}
      t={m.dashboard}
      languageButton={
        <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />
      }
    />
  );
}
