import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import TrialWelcome from "@/components/TrialWelcome";
import { isLang } from "@/i18n/locales";
import { TRIAL } from "@/i18n/messages/trial";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // Where Stripe sends the owner back to: private, never indexed.
  return { title: TRIAL[lang].welcome.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Welcome({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <TrialWelcome lang={lang} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f5f6f5" }} />}>
      <Welcome params={params} />
    </Suspense>
  );
}
