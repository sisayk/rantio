import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import NewsletterConfirm from "@/components/NewsletterConfirm";
import { getMessages } from "@/i18n";
import { isLang } from "@/i18n/locales";

type Props = { params: Promise<{ lang: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // A private link: never indexed, and the token never leaves in a Referer header.
  return { title: getMessages(lang).common.newsletter.page.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Confirm({ params }: Props) {
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  return <NewsletterConfirm lang={lang} token={token} t={getMessages(lang).common.newsletter.page} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f5f6f5" }} />}>
      <Confirm params={params} />
    </Suspense>
  );
}
