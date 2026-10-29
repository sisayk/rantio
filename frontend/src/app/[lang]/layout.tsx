import { notFound } from "next/navigation";
import { getMessages } from "@/i18n";
import { isLang, LANGS } from "@/i18n/locales";
import "../globals.css";

// One page tree for every language: /en, /fi, /sv, ... Unknown codes are 404s.
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getMessages(lang).guest.meta;
  return { title: t.title, description: t.description };
}

export default async function RootLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
