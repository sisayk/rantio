import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CottageDetail from "@/components/guest/CottageDetail";
import { getMessages } from "@/i18n";
import { countryName, plural } from "@/i18n/format";
import { isLang, type Lang, LANGS } from "@/i18n/locales";
import { pageMetadata, SITE_URL } from "@/i18n/seo";
import { getListing, type Listing, listingName, LISTINGS, unsplash } from "@/lib/listings";

type Props = { params: Promise<{ lang: string; id: string }> };

export function generateStaticParams() {
  return LANGS.flatMap((lang) => LISTINGS.map((l) => ({ lang, id: l.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  const l = getListing(id);
  if (!isLang(lang) || !l) return {};
  const m = getMessages(lang);
  const name = listingName(m.listingNames, l);
  const country = countryName(lang, l.country);
  return pageMetadata(
    lang,
    `/cottages/${l.id}`,
    `${name} – ${l.place} | Rantio`,
    // e.g. "Lakeside Villa, Savonlinna, Finland: 6 guests · 3 bedrooms · Sauna · Lakeside."
    `${name}, ${l.place}, ${country}: ${[
      plural(lang, m.guest.units.guests, l.guests),
      plural(lang, m.guest.units.bedrooms, l.bedrooms),
      ...l.features.slice(0, 4).map((k) => m.catalog.features[k]),
    ].join(" · ")}.`,
    unsplash(l.photo, 1200, 630, l.photoCrop),
  );
}

const SHOW_RENTAL_DATA = false;

/** schema.org VacationRental data for search engines, in the page's language. */
function structuredData(lang: Lang, l: Listing) {
  const m = getMessages(lang);
  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": `${SITE_URL}/${lang}/cottages/${l.id}#rental`,
    identifier: l.id,
    name: listingName(m.listingNames, l),
    url: `${SITE_URL}/${lang}/cottages/${l.id}`,
    inLanguage: lang,
    image: [unsplash(l.photo, 1600, 900, l.photoCrop)],
    address: { "@type": "PostalAddress", addressLocality: l.city, addressCountry: l.country },
    latitude: l.lat,
    longitude: l.lng,
    geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
    containsPlace: {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      occupancy: { "@type": "QuantitativeValue", value: l.guests },
      numberOfBedrooms: l.bedrooms,
      amenityFeature: l.features.map((k) => ({ "@type": "LocationFeatureSpecification", name: m.catalog.features[k], value: true })),
    },
  };
}

async function Cottage({ params }: Props) {
  const { lang, id } = await params;
  const l = getListing(id);
  if (!isLang(lang) || !l) notFound();
  return (
    <>
      {/* The cottages on the site are examples, so no VacationRental data for search engines:
          structuredData() is for real listings once they are here. */}
      {SHOW_RENTAL_DATA ? (
        <script
          type="application/ld+json"
          // JSON.stringify output with "<" escaped cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(lang, l)).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <CottageDetail lang={lang} listing={l} />
    </>
  );
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
