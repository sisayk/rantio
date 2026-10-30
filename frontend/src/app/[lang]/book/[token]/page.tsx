import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import BookingRequest from "@/components/BookingRequest";
import LanguageButton from "@/components/LanguagePicker";
import styles from "@/components/chat.module.css";
import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";

type Props = { params: Promise<{ lang: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // Only for the owner's own guests: never indexed, and the link never leaves in a Referer header.
  return { title: getMessages(lang).book.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Book({ params }: Props) {
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <BookingRequest
      lang={lang}
      token={token}
      t={m.book}
      languageButton={<LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />}
    />
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Book params={params} />
    </Suspense>
  );
}
