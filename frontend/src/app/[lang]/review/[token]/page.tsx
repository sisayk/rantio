import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LanguageButton from "@/components/LanguagePicker";
import ReviewForm from "@/components/ReviewForm";
import styles from "@/components/chat.module.css";
import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import { isLang } from "@/i18n/locales";
import { REVIEWS } from "@/i18n/messages/reviews";

type Props = { params: Promise<{ lang: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // The guest's private link: never indexed, and never sent on in a Referer header.
  return { title: `${REVIEWS[lang].page.title} | Rantio`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Review({ params }: Props) {
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  const m = getMessages(lang);
  return (
    <ReviewForm
      lang={lang}
      token={token}
      loading={m.guest.chat.loading}
      languageButton={<LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.quietLink} />}
    />
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Review params={params} />
    </Suspense>
  );
}
