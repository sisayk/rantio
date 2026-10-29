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
    title: `${l.name.en} – ${l.place} | Stugora`,
    description: `${l.name.en}, ${l.place}, ${guestContent.en.countries[l.country]}.`,
    alternates: { languages: { fi: cottageHref("fi", l.id) } },
  };
}

export default async function Page({ params }: Props) {
  const l = getListing((await params).id);
  if (!l) notFound();
  return <CottageDetail lang="en" listing={l} />;
}
