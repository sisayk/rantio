import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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

async function Cottage({ params }: Props) {
  const l = getListing((await params).id);
  if (!l) notFound();
  return <CottageDetail lang="en" listing={l} />;
}

// Every cottage page is prerendered from generateStaticParams; the boundary keeps
// client-side navigation instant while the cottage id is read.
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Cottage params={params} />
    </Suspense>
  );
}
