"use client";

/* eslint-disable @next/next/no-img-element -- the owner's own uploads, served by Django */
import AmenityIcon from "@/components/AmenityIcon";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { amenityName } from "@/lib/amenities";
import { formatPrice, isCurrency } from "@/lib/currency";
import { type ListingPreview as Data, ownerApi, SignedOut } from "@/lib/ownerApi";
import { Wordmark } from "../../guest/icons";
import o from "../owner.module.css";
import { Dialog } from "./ui";
import s from "./editor.module.css";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false, loading: () => <div className={s.map} /> });

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The owner's listing laid out the way guests see a cottage: for checking, never public. */
export default function ListingPreview({
  lang,
  id,
  l,
  t,
  features,
  countries,
}: {
  lang: Lang;
  id: number;
  l: Messages["listings"];
  t: Messages["dashboard"];
  features: Record<string, string>;
  countries: Record<string, string>;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [photosOpen, setPhotosOpen] = useState(false);
  const p = l.preview;

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setData(await ownerApi.listingPreview(id));
        setState("ready");
      } catch (err) {
        if (err instanceof SignedOut) return window.location.replace(paths.hostingLogin(lang));
        setState((err as { status?: number }).status === 404 ? "missing" : "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, lang]);

  const months = useMemo(() => {
    const now = new Date();
    return [0, 1].map((k) => new Date(now.getFullYear(), now.getMonth() + k, 1, 12));
  }, []);

  if (state !== "ready" || !data) {
    return (
      <div className={o.page}>
        <main className={o.main}>
          {state === "loading" ? (
            <div className={o.skeleton} aria-busy="true" aria-label={t.loading}>
              <span />
              <span />
            </div>
          ) : (
            <div className={o.errorBox} role="alert">
              <p>{state === "missing" ? l.notFound : t.error}</p>
              <a className={o.primary} href={paths.hostingListings(lang)}>
                {l.back}
              </a>
            </div>
          )}
        </main>
      </div>
    );
  }

  const currency = isCurrency(data.currency) ? data.currency : "EUR";
  const price = (v: string | null) => formatPrice(lang, Number(v ?? 0), currency);
  const description = data.descriptions[lang] ?? data.descriptions.en ?? Object.values(data.descriptions)[0] ?? "";
  const busy = (day: string) => data.busy.some((b) => day >= b.start && day < b.end);
  const intl = LANG_INFO[lang].intl;
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(intl, { weekday: "narrow" }).format(new Date(2024, 0, 1 + i, 12)));
  const point = data.latitude !== null && data.longitude !== null ? { lat: data.latitude, lng: data.longitude } : null;
  const banner = data.status === "live" ? p.banner : data.status === "paused" || data.status === "archived" ? p.bannerPaused : p.bannerDraft;
  const ruleLines = [
    data.check_in_from ? (data.check_in_until ? fill(lang, p.checkInRange, { from: data.check_in_from, until: data.check_in_until }) : fill(lang, p.checkIn, { from: data.check_in_from })) : null,
    data.check_out_by ? fill(lang, p.checkOut, { time: data.check_out_by }) : null,
    data.self_check_in ? p.selfCheckIn : null,
    data.pets_allowed ? p.petsYes : p.petsNo,
    data.smoking_allowed ? p.smokingYes : p.smokingNo,
    data.events_allowed ? p.eventsYes : p.eventsNo,
    data.quiet_hours ? fill(lang, p.quiet, { hours: data.quiet_hours }) : null,
    data.min_age ? fill(lang, p.minAge, { n: data.min_age }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className={s.previewWrap}>
      <div className={s.previewBar} role="note">
        <span>{banner}</span>
        <a href={paths.hostingListing(lang, id)}>{p.close}</a>
      </div>
      <div className={s.preview}>
        <p style={{ margin: "0 0 16px" }}>
          <span className={o.brand} style={{ fontSize: 22 }}>
            <Wordmark />
          </span>
        </p>
        <div className={s.previewTitle}>
          <h1>{data.name}</h1>
          <p className={s.muted} style={{ margin: 0 }}>
            {l.types[data.property_type]} · {[data.municipality, countries[data.country] ?? data.country].filter(Boolean).join(", ")}
          </p>
        </div>

        {data.photos.length ? (
          <div className={s.gallery}>
            {data.photos.slice(0, 5).map((ph) => (
              <img key={ph.id} src={ph.url} alt={ph.caption || l.photos.kinds[ph.kind]} />
            ))}
          </div>
        ) : (
          <div className={s.galleryEmpty}>{p.noPhotos}</div>
        )}
        {data.photos.length > 1 ? (
          <p style={{ margin: "-8px 0 16px" }}>
            <button type="button" className={s.button} onClick={() => setPhotosOpen(true)}>
              {p.allPhotos}
            </button>
          </p>
        ) : null}

        <div className={s.previewCols}>
          <div>
            <div className={s.previewSection} style={{ borderTop: 0, paddingTop: 0 }}>
              <p>
                {[
                  plural(lang, l.units.guests, data.max_guests),
                  plural(lang, l.units.bedrooms, data.bedrooms),
                  plural(lang, l.units.beds, data.beds),
                  plural(lang, l.units.bathrooms, data.bathrooms),
                  data.floor_area ? `${data.floor_area} m²` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {data.host_languages.length ? (
                <p className={s.muted}>{fill(lang, p.hostSpeaks, { languages: data.host_languages.map((c) => LANG_INFO[c as Lang]?.native ?? c).join(", ") })}</p>
              ) : null}
            </div>
            <div className={s.previewSection}>
              <h2>{p.about}</h2>
              <p>{description || p.noDescription}</p>
            </div>
            {data.amenities.length ? (
              <div className={s.previewSection}>
                <h2>{p.whatHas}</h2>
                <ul className={s.amenityList}>
                  {data.amenities.map((k) => {
                    const note = data.amenity_notes[k];
                    return (
                      <li key={k}>
                        <AmenityIcon amenity={k} className={s.amenityIcon} />
                        {amenityName(k, features, l.amenities.names)}
                        {note ? (
                          <small>{[note.note, note.fee !== null ? formatPrice(lang, Number(note.fee), currency, true) : ""].filter(Boolean).join(" · ")}</small>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className={s.previewSection}>
              <h2>{p.rules}</h2>
              <ul className={s.amenityList}>
                {ruleLines.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {[data.house_rules, data.sauna_instructions, data.fireplace_instructions, data.waste_instructions].filter(Boolean).map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
            <div className={s.previewSection}>
              <h2>{p.whereTitle}</h2>
              {point ? <PinMap point={point} fallback={point} approximate={!data.show_exact_location} label={p.whereTitle} /> : null}
              {!data.show_exact_location ? <p className={s.muted}>{p.approximate}</p> : null}
              {data.nearby.length ? (
                <>
                  <h3>{p.nearby}</h3>
                  <ul className={s.amenityList}>
                    {data.nearby.map((n, i) => (
                      <li key={i}>
                        {n.name}
                        <small>
                          {l.location.kinds[n.kind]}
                          {n.distance_km ? ` · ${n.distance_km} km` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div className={s.previewSection}>
              <h2>{p.availability}</h2>
              <p className={s.muted}>{p.availabilityLead}</p>
              <div className={s.months}>
                {months.map((first) => {
                  const offset = (first.getDay() + 6) % 7;
                  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
                  return (
                    <div key={first.toISOString()} className={s.month}>
                      <h3>{monthName.format(first)}</h3>
                      <div className={s.monthGrid}>
                        {weekdays.map((w, i) => (
                          <b key={i}>{w}</b>
                        ))}
                        {Array.from({ length: offset }, (_, i) => (
                          <span key={`b${i}`} />
                        ))}
                        {Array.from({ length: days }, (_, i) => {
                          const day = iso(new Date(first.getFullYear(), first.getMonth(), i + 1, 12));
                          return (
                            <span key={day} data-busy={busy(day)}>
                              {i + 1}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <aside className={s.bookBox}>
            <strong>{fill(lang, p.from, { price: price(data.price_per_night) })}</strong>
            {data.weekend_price ? <span>{fill(lang, p.weekend, { price: price(data.weekend_price) })}</span> : null}
            {Number(data.cleaning_fee) > 0 ? <span>{fill(lang, p.cleaning, { price: price(data.cleaning_fee) })}</span> : null}
            <span>{plural(lang, p.minStay, data.min_nights)}</span>
            {data.taxes_note ? <span className={s.muted}>{data.taxes_note}</span> : null}
            <button type="button" className={o.primary} disabled title={p.requestNote}>
              {p.request}
            </button>
            <span className={`${s.muted} ${s.small}`}>{p.requestNote}</span>
          </aside>
        </div>
      </div>
      <Dialog open={photosOpen} title={p.allPhotos} onClose={() => setPhotosOpen(false)}>
        <div className={s.lightbox} style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {data.photos.map((ph) => (
            <figure key={ph.id}>
              <img src={ph.url} alt={ph.caption || l.photos.kinds[ph.kind]} loading="lazy" />
              <figcaption>{ph.caption || l.photos.kinds[ph.kind]}</figcaption>
            </figure>
          ))}
        </div>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setPhotosOpen(false)}>
            {p.close}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
