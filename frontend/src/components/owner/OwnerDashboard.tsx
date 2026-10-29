"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, number, plural } from "@/i18n/format";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { type BookingRow, ownerApi, SignedOut, type Summary } from "@/lib/ownerApi";
import { Bed, CalendarIcon, People } from "../guest/icons";
import EarningsChart from "./EarningsChart";
import HostingHeader from "./HostingHeader";
import SiteIcon from "./SiteIcon";
import styles from "./owner.module.css";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; summary: Summary; bookings: BookingRow[] };

const DAY = 86_400_000;
const FIRST_ROWS = 12;
const parse = (iso: string) => new Date(`${iso}T12:00:00`);

type T = Messages["dashboard"];

export default function OwnerDashboard({
  lang,
  t,
  languageButton,
}: {
  lang: Lang;
  t: T;
  languageButton: React.ReactNode;
}) {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [allRows, setAllRows] = useState(false);
  // Figures come in the owner's currency (a Swedish owner's in kronor); each stay in its cottage's.
  const currency: Currency = load.state === "ready" && isCurrency(load.summary.currency) ? load.summary.currency : "EUR";
  const cur = (b: BookingRow): Currency => (isCurrency(b.currency) ? b.currency : currency);

  // The dashboard renders only in the browser, after the figures load, so Intl dates are safe here;
  // numbers and money use the site's own formatting (src/i18n/format.ts, src/lib/currency.ts).
  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    const day = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
    const full = new Intl.DateTimeFormat(intl, { day: "numeric", month: lang === "fi" ? "numeric" : "short", year: "numeric" });
    return {
      /** Whole amounts in the owner's currency (or the booking's own). */
      cur: (v: string | number, c: Currency = currency) => formatPrice(lang, Number(v), c),
      cents: (v: string | number, c: Currency = currency) => formatPrice(lang, Number(v), c, true),
      date: (iso: string) => full.format(parse(iso)),
      range: (a: string, b: string) => `${day.format(parse(a))} – ${day.format(parse(b))}`,
      pct: (v: number) => number(lang, Math.round(v * 100)),
      rate: (r: string) => number(lang, Number(r), { max: 2 }),
    };
  }, [lang, currency]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const summary = await ownerApi.summary(year);
        const { results } = await ownerApi.bookings(summary.year);
        if (live) setLoad({ state: "ready", summary, bookings: results });
      } catch (err) {
        if (!live) return;
        if (err instanceof SignedOut) window.location.replace(paths.hostingLogin(lang));
        else setLoad({ state: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [year, lang, attempt]);

  const pickYear = useCallback((y: number) => {
    setLoad({ state: "loading" });
    setAllRows(false);
    setYear(y);
  }, []);

  function downloadCsv(s: Summary, rows: BookingRow[]) {
    const fi = lang === "fi";
    const sep = fi ? ";" : ",";
    const num = (v: string) => (fi ? v.replace(".", ",") : v);
    const st = t.statement;
    const lines = [
      [st.cottage, "check-in", "check-out", st.site, st.nights, st.guests, st.payout, st.commission, st.vat, "currency", st.cancelled],
      ...rows.map((r) => [
        r.cottage, r.check_in, r.check_out, r.channel_label, String(r.nights), String(r.guests),
        num(r.payout), num(r.commission), num(r.commission_vat), r.currency, r.cancelled ? "x" : "",
      ]),
    ];
    const csv = lines.map((l) => l.map((c) => `"${c.replaceAll('"', '""')}"`).join(sep)).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `stugora-${s.year}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const header = (
    <HostingHeader
      lang={lang}
      t={t}
      languageButton={languageButton}
      active="overview"
      ownerName={load.state === "ready" ? load.summary.owner.name : undefined}
      unread={load.state === "ready" ? load.summary.unread_messages : 0}
    />
  );

  if (load.state !== "ready") {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          {load.state === "loading" ? (
            <div className={styles.skeleton} aria-busy="true" aria-label={t.loading}>
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className={styles.errorBox} role="alert">
              <p>{t.error}</p>
              <button type="button" className={styles.primary} onClick={() => { setLoad({ state: "loading" }); setAttempt((n) => n + 1); }}>
                {t.retry}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  const { summary: s, bookings } = load;
  const today = parse(s.today);
  const tt = s.totals;

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.main}>
        <div className={styles.intro}>
          <div>
            <h1>{fill(lang, t.hello, { name: s.owner.first_name })}</h1>
            <p>{t.lead}</p>
          </div>
          <div className={styles.years} role="group" aria-label={t.year}>
            {s.years.map((y) => (
              <button key={y} type="button" aria-pressed={y === s.year} onClick={() => pickYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>

        <section aria-labelledby="upcoming-title" className={styles.section}>
          <h2 id="upcoming-title">{t.upcoming.title}</h2>
          {s.upcoming.length ? (
            <ul className={styles.stays}>
              {s.upcoming.map((b) => {
                const days = Math.round((parse(b.check_in).getTime() - today.getTime()) / DAY);
                const when = b.staying_now
                  ? t.upcoming.now
                  : days === 0 ? t.upcoming.today : days === 1 ? t.upcoming.tomorrow : plural(lang, t.upcoming.inDays, days);
                return (
                  <li key={b.id} className={styles.stay} data-now={b.staying_now}>
                    <span className={styles.stayWhen}>{when}</span>
                    <strong>{b.cottage}</strong>
                    <span className={styles.stayLine}>
                      <CalendarIcon className={styles.icon16} />
                      {fmt.range(b.check_in, b.check_out)}
                    </span>
                    <span className={styles.stayLine}>
                      <Bed className={styles.icon16} />
                      {plural(lang, t.nights, b.nights)}
                      <People className={styles.icon16} />
                      {b.guests}
                    </span>
                    <span className={styles.stayFoot}>
                      <SiteIcon channel={b.channel} label={b.channel_label} ownBooking={t.ownBooking} />
                      <b>{fmt.cur(b.payout, cur(b))}</b>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.note}>{t.upcoming.empty}</p>
          )}
        </section>

        <section className={styles.kpis} aria-label={String(s.year)}>
          <div className={styles.kpi}>
            <span>{t.kpi.payout}</span>
            <strong>{fmt.cur(tt.payout)}</strong>
            <small>{fill(lang, t.kpi.payoutSub, { stugora: fmt.cur(tt.payout_stugora), own: fmt.cur(tt.payout_own) })}</small>
          </div>
          <div className={styles.kpi}>
            <span>{t.kpi.bookings}</span>
            <strong>{number(lang, tt.bookings)}</strong>
            <small>
              {plural(lang, t.nights, tt.nights)}
              {tt.cancelled ? `, ${plural(lang, t.kpi.cancelled, tt.cancelled)}` : ""}
            </small>
          </div>
          <div className={styles.kpi}>
            <span>{t.kpi.stugora}</span>
            <strong>{fmt.cur(tt.stugora_total)}</strong>
            <small>{fill(lang, t.kpi.stugoraSub, { rate: fmt.rate(s.owner.commission_rate) })}</small>
          </div>
          <div className={`${styles.kpi} ${styles.kpiNet}`}>
            <span>{t.kpi.net}</span>
            <strong>{fmt.cur(tt.net)}</strong>
            <small>{t.kpi.netSub}</small>
          </div>
        </section>

        <section aria-labelledby="chart-title" className={`${styles.section} ${styles.card}`}>
          <h2 id="chart-title">{t.chart.title}</h2>
          <p className={styles.lead}>{t.chart.lead}</p>
          <EarningsChart months={s.months} year={s.year} lang={lang} t={t} currency={currency} />
        </section>

        <div className={styles.columns}>
          <section aria-labelledby="sites-title" className={`${styles.section} ${styles.card}`}>
            <h2 id="sites-title">{t.sites.title}</h2>
            {s.channels.length ? (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t.sites.site}</th>
                      <th scope="col" className={styles.num}>{t.sites.bookings}</th>
                      <th scope="col" className={styles.num}>{t.sites.nights}</th>
                      <th scope="col" className={styles.num}>{t.sites.payout}</th>
                      <th scope="col" className={styles.num}>{t.sites.commission}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.channels.map((c) => (
                      <tr key={c.channel}>
                        <th scope="row"><SiteIcon channel={c.channel} label={c.label} ownBooking={t.ownBooking} /></th>
                        <td className={styles.num}>{c.bookings}</td>
                        <td className={styles.num}>{c.nights}</td>
                        <td className={styles.num}>{fmt.cur(c.payout)}</td>
                        <td className={styles.num}>{c.charged ? fmt.cur(c.commission) : <span className={styles.free}>{t.sites.free}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>{t.sites.empty}</p>
            )}
          </section>

          <section aria-labelledby="cottages-title" className={`${styles.section} ${styles.card}`}>
            <h2 id="cottages-title">{t.cottages.title}</h2>
            <ul className={styles.cottages}>
              {s.cottages.map((c) => (
                <li key={c.id}>
                  <div className={styles.cottageHead}>
                    <strong>{c.name}</strong>
                    <span className={styles.status} data-status={c.status}>{t.cottages.status[c.status]}</span>
                  </div>
                  <span className={styles.muted}>{c.municipality}</span>
                  {c.status === "live" || c.listing_year ? (
                    <>
                      <span className={styles.cottageLine}>
                        {c.listing_year ? fill(lang, t.cottages.listingYear, { n: String(c.listing_year) }) : null}
                        {c.listing_year ? " · " : null}
                        {plural(lang, t.cottages.nightsBooked, c.nights)}
                      </span>
                      {c.occupancy !== null ? (
                        <span className={styles.meter}>
                          <span style={{ width: `${Math.min(c.occupancy, 1) * 100}%` }} />
                          <em>{fill(lang, t.cottages.occupancy, { pct: fmt.pct(c.occupancy) })}</em>
                        </span>
                      ) : null}
                      {c.next_fee_on && c.next_fee ? (
                        <span className={styles.muted}>
                          {fill(lang, t.cottages.nextFee, { date: fmt.date(c.next_fee_on), fee: fmt.cents(c.next_fee, "EUR") })}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className={styles.muted}>{t.cottages.notLive}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="statement-title" className={`${styles.section} ${styles.card}`}>
          <div className={styles.sectionHead}>
            <h2 id="statement-title">{fill(lang, t.statement.title, { year: String(s.year) })}</h2>
            {bookings.length ? (
              <button type="button" className={styles.outline} onClick={() => downloadCsv(s, bookings)}>
                {t.statement.csv}
              </button>
            ) : null}
          </div>
          {bookings.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t.statement.dates}</th>
                    <th scope="col">{t.statement.cottage}</th>
                    <th scope="col">{t.statement.site}</th>
                    <th scope="col" className={styles.num}>{t.statement.nights}</th>
                    <th scope="col" className={styles.num}>{t.statement.guests}</th>
                    <th scope="col" className={styles.num}>{t.statement.payout}</th>
                    <th scope="col" className={styles.num}>{t.statement.commission}</th>
                    <th scope="col" className={styles.num}>{t.statement.vat}</th>
                  </tr>
                </thead>
                <tbody>
                  {(allRows ? bookings : bookings.slice(0, FIRST_ROWS)).map((b) => (
                    <tr key={b.id} data-cancelled={b.cancelled}>
                      <th scope="row">
                        {fmt.range(b.check_in, b.check_out)}
                        {b.cancelled ? <span className={styles.cancelled}>{t.statement.cancelled}</span> : null}
                      </th>
                      <td>{b.cottage}</td>
                      <td><SiteIcon channel={b.channel} label={b.channel_label} ownBooking={t.ownBooking} /></td>
                      <td className={styles.num}>{b.nights}</td>
                      <td className={styles.num}>{b.guests}</td>
                      <td className={styles.num}>{fmt.cents(b.payout, cur(b))}</td>
                      <td className={styles.num}>{b.charged ? fmt.cents(b.commission, cur(b)) : "–"}</td>
                      <td className={styles.num}>{b.charged ? fmt.cents(b.commission_vat, cur(b)) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>{t.statement.empty}</p>
          )}
          {bookings.length > FIRST_ROWS ? (
            <button type="button" className={`${styles.outline} ${styles.showAll}`} onClick={() => setAllRows(!allRows)}>
              {allRows ? t.statement.showFewer : plural(lang, t.statement.showAll, bookings.length)}
            </button>
          ) : null}
        </section>

        <section aria-labelledby="fees-title" className={`${styles.section} ${styles.card}`}>
          <h2 id="fees-title">{t.fees.title}</h2>
          {s.fees.length ? (
            <ul className={styles.fees}>
              {s.fees.map((f) => (
                <li key={`${f.cottage}-${f.listing_year}`}>
                  <span>
                    <strong>{f.cottage}</strong>
                    <span className={styles.muted}>
                      {fill(lang, t.fees.line, { n: String(f.listing_year), date: fmt.date(f.starts_on) })}
                    </span>
                  </span>
                  <span className={styles.num}>
                    {Number(f.fee) === 0
                      ? t.fees.free
                      : `${fmt.cents(f.fee, "EUR")} ${fill(lang, t.fees.plusVat, { vat: fmt.cents(f.vat, "EUR") })}`}
                    {Number(f.fee) !== 0 && currency !== "EUR" ? (
                      <small className={styles.muted}> ≈ {fmt.cur(f.fee_local)}</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>{t.fees.empty}</p>
          )}
          <p className={styles.howItWorks}>{t.howItWorks}</p>
        </section>
      </main>
    </div>
  );
}
