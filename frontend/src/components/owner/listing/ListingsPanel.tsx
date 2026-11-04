"use client";

import { useEffect, useMemo, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, number } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { type ListingSummary, ownerApi } from "@/lib/ownerApi";
import o from "../owner.module.css";
import { dateFormats } from "./shared";
import s from "./editor.module.css";

const WEEK = 7 * 86_400_000;

/** Overview's view of the listings: how many, which need a look, who arrives and leaves this week. */
export default function ListingsPanel({ lang, l }: { lang: Lang; l: Messages["listings"] }) {
  const [cottages, setCottages] = useState<ListingSummary[] | null>(null);
  const fmt = useMemo(() => dateFormats(lang), [lang]);
  const ov = l.overview;

  useEffect(() => {
    let live = true;
    ownerApi.listings().then(
      (r) => live && setCottages(r.cottages),
      () => live && setCottages([]),
    );
    return () => {
      live = false;
    };
  }, []);

  if (!cottages || cottages.length === 0) return null;

  const active = cottages.filter((c) => c.status !== "archived");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(`${iso}T12:00:00`).getTime();
    return d >= today.getTime() && d < today.getTime() + WEEK;
  };
  const checkIns = active.flatMap((c) => c.upcoming.filter((b) => soon(b.check_in)).map((b) => ({ c, date: b.check_in, id: b.id })));
  const checkOuts = active.flatMap((c) => c.upcoming.filter((b) => soon(b.check_out)).map((b) => ({ c, date: b.check_out, id: b.id })));
  const warnings = active.flatMap((c) =>
    c.channels.filter((ch) => ch.state === "failed" || ch.state === "attention").map((ch) => ({ c, ch })),
  );
  const incomplete = active.filter((c) => c.missing.length > 0 || c.completeness < 70);
  const attention = new Set([...warnings.map((w) => w.c.id), ...active.filter((c) => c.missing.length).map((c) => c.id)]);
  const stat = (label: string, n: number, href: string) => (
    <a href={href}>
      <span>{label}</span>
      <strong>{number(lang, n)}</strong>
    </a>
  );
  const siteName = (ch: string) => ({ airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", agoda: "Agoda", nettimokki: "Nettimökki" })[ch] ?? ch;

  return (
    <section aria-labelledby="listings-panel" className={`${o.section} ${o.card}`}>
      <div className={o.sectionHead}>
        <h2 id="listings-panel">{ov.title}</h2>
        <a className={o.outline} href={paths.hostingListings(lang)}>
          {ov.manage}
        </a>
      </div>
      <div className={s.overviewStats}>
        {stat(ov.total, active.length, paths.hostingListings(lang))}
        {stat(ov.published, active.filter((c) => c.status === "live").length, paths.hostingListings(lang))}
        {stat(ov.paused, active.filter((c) => c.status === "paused").length, paths.hostingListings(lang))}
        {stat(ov.attention, attention.size, paths.hostingListings(lang))}
      </div>
      <div className={s.overviewCols}>
        <div>
          <h3>{ov.checkIns}</h3>
          {checkIns.length ? (
            <ul className={s.plainList}>
              {checkIns.map((x) => (
                <li key={`in${x.id}`}>
                  {fmt.day(x.date)} · <a href={paths.hostingListing(lang, x.c.id)}>{x.c.name}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{ov.none}</p>
          )}
        </div>
        <div>
          <h3>{ov.checkOuts}</h3>
          {checkOuts.length ? (
            <ul className={s.plainList}>
              {checkOuts.map((x) => (
                <li key={`out${x.id}`}>
                  {fmt.day(x.date)} · <a href={paths.hostingListing(lang, x.c.id)}>{x.c.name}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{ov.none}</p>
          )}
        </div>
        {warnings.length ? (
          <div>
            <h3>{ov.syncWarnings}</h3>
            <ul className={s.plainList}>
              {warnings.map(({ c, ch }) => (
                <li key={`${c.id}${ch.channel}`}>
                  <span className={s.dot} data-state={ch.state} style={{ display: "inline-block", marginRight: 6 }} />
                  <a href={`${paths.hostingListing(lang, c.id)}#calendar`}>
                    {fill(lang, ov.syncLine, { cottage: c.name, site: siteName(ch.channel), state: l.calendar.states[ch.state] })}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {incomplete.length ? (
          <div>
            <h3>{ov.finish}</h3>
            <ul className={s.plainList}>
              {incomplete.map((c) => (
                <li key={c.id} className={s.progress}>
                  <a href={`${paths.hostingListing(lang, c.id)}#overview`}>{fill(lang, ov.incomplete, { cottage: c.name, pct: number(lang, c.completeness) })}</a>
                  <span className={s.progressBar}>
                    <span style={{ width: `${c.completeness}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
