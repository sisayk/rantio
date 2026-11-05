import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PaymentSaved from "@/components/owner/PaymentSaved";
import { isLang } from "@/i18n/locales";
import { ACCOUNT } from "@/i18n/messages/account";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${ACCOUNT[lang].profile.savedMethod} | Rantio`, robots: { index: false, follow: false } };
}

async function Saved({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <PaymentSaved lang={lang} />;
}

/** Back from Stripe's page (Account → Payment method). From the app, it opens the app again. */
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Saved params={params} />
    </Suspense>
  );
}
