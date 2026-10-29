import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CottageDetail from "@/components/guest/CottageDetail";
import { guestContent } from "@/lib/guestContent";
import { cottageHref, getListing, LISTINGS } from "@/lib/listings";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return LISTINGS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = getListing((await params).id);
  if (!l) return {};
  return {
    title: `${l.name.fi} – ${l.place} | Stugora`,
    description: `${l.name.fi}, ${l.place}, ${guestContent.fi.countries[l.country]}.`,
    alternates: { languages: { en: cottageHref("en", l.id) } },
  };
}

export default async function Page({ params }: Props) {
  const l = getListing((await params).id);
  if (!l) notFound();
  return <CottageDetail lang="fi" listing={l} />;
}
