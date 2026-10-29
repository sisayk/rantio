"use client";
/* eslint-disable @next/next/no-img-element -- small favicons loaded from each listing site */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import type { Lang } from "@/lib/content";
import { type BookingRow, loginHref, ownerApi, SignedOut, type Summary } from "@/lib/ownerApi";
import { ownerContent } from "@/lib/ownerContent";
import { Bed, CalendarIcon, Logo, People } from "../guest/icons";
import EarningsChart from "./EarningsChart";
import styles from "./owner.module.css";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; summary: Summary; bookings: BookingRow[] };

const DAY = 86_400_000;
const FIRST_ROWS = 12;
const parse = (iso: string) => new Date(`${iso}T12:00:00`);

function SiteIcon({ channel, label, t }: { channel: string; label: string; t: ReturnType<typeof copy> }) {
  const known = channel in CHANNELS ? (channel as ChannelId) : null;
  const name = known ? CHANNELS[known].name : channel === "owner" ? t.ownBooking : channel === "direct" ? t.stugoraDirect : label;
  return (
    <span className={styles.site}>
      <span className={styles.siteIcon} aria-hidden="true">
        <span>{name.charAt(0)}</span>
        {known ? <img src={channelIcon(known)} alt="" width={18} height={18} loading="lazy" referrerPolicy="no-referrer" /> : null}
      </span>
      {name}
    </span>
  );
}

const copy = (lang: Lang) => ownerContent[lang];

export default function OwnerDashboard({ lang }: { lang: Lang }) {
  const t = copy(lang);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [allRows, setAllRows] = useState(false);

  const fmt = useMemo(() => {
    const eur0 = new Intl.NumberFormat(t.locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    const eur2 = new Intl.NumberFormat(t.locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
    const day = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short" });
    const full = new Intl.DateTimeFormat(t.locale, {
      day: "numeric",
      month: lang === "fi" ? "numeric" : "short",
      year: "numeric",
    });
    const pct = new Intl.NumberFormat(t.locale, { style: "percent", maximumFractionDigits: 0 });
    return {
      eur: (v: string | number) => eur0.format(Number(v)),
      eurCents: (v: string | number) => eur2.format(Number(v)),
      day: (iso: string) => day.format(parse(iso)),
      date: (iso: string) => full.format(parse(iso)),
      range: (a: string, b: string) => `${day.format(parse(a))} – ${day.format(parse(b))}`,
      pct: (v: number) => pct.format(v),
      rate: (r: string) => Number(r).toLocaleString(t.locale, { maximumFractionDigits: 2 }),
    };
  }, [t.locale, lang]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const summary = await ownerApi.summary(year);
        const { results } = await ownerApi.bookings(summary.year);
        if (live) setLoad({ state: "ready", summary, bookings: results });
      } catch (err) {
        if (!live) return;
        if (err instanceof SignedOut) window.location.replace(loginHref(lang));
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

  async function logout() {
    await ownerApi.logout().catch(() => undefined);
    window.location.assign(loginHref(lang));
  }

  function downloadCsv(s: Summary, rows: BookingRow[]) {
    const fi = lang === "fi";
    const sep = fi ? ";" : ",";
    const num = (v: string) => (fi ? v.replace(".", ",") : v);
    const st = t.statement;
    const lines = [
      [st.cottage, "check-in", "check-out", st.site, st.nights, st.guests, st.payout, st.commission, st.vat, st.cancelled],
      ...rows.map((r) => [
        r.cottage, r.check_in, r.check_out, r.channel_label, String(r.nights), String(r.guests),
        num(r.payout), num(r.commission), num(r.commission_vat), r.cancelled ? "x" : "",
      ]),
    ];
    const csv = lines.map((l) => l.map((c) => `"${c.replaceAll('"', '""')}"`).join(sep)).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `stugora-${s.year}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const header = (
    <header className={styles.top}>
      <div className={styles.topInner}>
        <a className={styles.brand} href={lang === "fi" ? "/" : "/en"}>
          <Logo className={styles.logo} />
          Stugora
          <span className={styles.area}>{t.area}</span>
        </a>
        <nav className={styles.topNav}>
          <a className={styles.quietLink} href={t.otherLang.dashboard} hrefLang={lang === "fi" ? "en" : "fi"}>
            {t.otherLang.label}
          </a>
          {load.state === "ready" ? <span className={styles.who}>{load.summary.owner.name}</span> : null}
          <button type="button" className={styles.outline} onClick={logout}>
            {t.nav.logout}
          </button>
        </nav>
      </div>
    </header>
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
            <h1>{t.hello(s.owner.first_name)}</h1>
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
                  : days === 0 ? t.upcoming.today : days === 1 ? t.upcoming.tomorrow : t.upcoming.inDays(days);
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
                      {t.chart.nights(b.nights)}
                      <People className={styles.icon16} />
                      {b.guests}
                    </span>
                    <span className={styles.stayFoot}>
                      <SiteIcon channel={b.channel} label={b.channel_label} t={t} />
                      <b>{fmt.eur(b.payout)}</b>
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
            <strong>{fmt.eur(tt.payout)}</strong>
            <small>{t.kpi.payoutSub(fmt.eur(tt.payout_stugora), fmt.eur(tt.payout_own))}</small>
          </div>
          <div className={styles.kpi}>
            <span>{t.kpi.bookings}</span>
            <strong>{tt.bookings}</strong>
            <small>{t.kpi.bookingsSub(tt.nights, tt.cancelled)}</small>
          </div>
          <div className={styles.kpi}>
            <span>{t.kpi.stugora}</span>
            <strong>{fmt.eur(tt.stugora_total)}</strong>
            <small>{t.kpi.stugoraSub(fmt.rate(s.owner.commission_rate))}</small>
          </div>
          <div className={`${styles.kpi} ${styles.kpiNet}`}>
            <span>{t.kpi.net}</span>
            <strong>{fmt.eur(tt.net)}</strong>
            <small>{t.kpi.netSub}</small>
          </div>
        </section>

        <section aria-labelledby="chart-title" className={`${styles.section} ${styles.card}`}>
          <h2 id="chart-title">{t.chart.title}</h2>
          <p className={styles.lead}>{t.chart.lead}</p>
          <EarningsChart months={s.months} year={s.year} t={t} money={fmt.eur} />
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
                        <th scope="row"><SiteIcon channel={c.channel} label={c.label} t={t} /></th>
                        <td className={styles.num}>{c.bookings}</td>
                        <td className={styles.num}>{c.nights}</td>
                        <td className={styles.num}>{fmt.eur(c.payout)}</td>
                        <td className={styles.num}>{c.charged ? fmt.eur(c.commission) : <span className={styles.free}>{t.sites.free}</span>}</td>
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
                        {c.listing_year ? t.cottages.listingYear(c.listing_year) : null}
                        {c.listing_year ? " · " : null}
                        {t.cottages.nights(c.nights)}
                      </span>
                      {c.occupancy !== null ? (
                        <span className={styles.meter} aria-label={`${t.cottages.occupancy} ${fmt.pct(c.occupancy)}`}>
                          <span style={{ width: `${Math.min(c.occupancy, 1) * 100}%` }} />
                          <em>{t.cottages.occupancy} {fmt.pct(c.occupancy)}</em>
                        </span>
                      ) : null}
                      {c.next_fee_on && c.next_fee ? (
                        <span className={styles.muted}>{t.cottages.nextFee(fmt.date(c.next_fee_on), fmt.eurCents(c.next_fee))}</span>
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
            <h2 id="statement-title">{t.statement.title(s.year)}</h2>
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
                      <td><SiteIcon channel={b.channel} label={b.channel_label} t={t} /></td>
                      <td className={styles.num}>{b.nights}</td>
                      <td className={styles.num}>{b.guests}</td>
                      <td className={styles.num}>{fmt.eurCents(b.payout)}</td>
                      <td className={styles.num}>{b.charged ? fmt.eurCents(b.commission) : "–"}</td>
                      <td className={styles.num}>{b.charged ? fmt.eurCents(b.commission_vat) : "–"}</td>
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
              {allRows ? t.statement.showFewer : t.statement.showAll(bookings.length)}
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
                    <span className={styles.muted}>{t.fees.line(f.listing_year, fmt.date(f.starts_on))}</span>
                  </span>
                  <span className={styles.num}>
                    {Number(f.fee) === 0 ? t.fees.free : `${fmt.eurCents(f.fee)} ${t.fees.plusVat(fmt.eurCents(f.vat))}`}
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
