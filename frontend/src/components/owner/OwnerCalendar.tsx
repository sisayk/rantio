"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { formatPrice, isCurrency } from "@/lib/currency";
import { paths } from "@/i18n/paths";
import {
  type CalendarCottage,
  type CalendarData,
  type CalendarEntry,
  type CalendarFeed,
  type NightPriceRow,
  ownerApi,
  SignedOut,
} from "@/lib/ownerApi";
import HostingHeader from "./HostingHeader";
import RequestCard from "./RequestCard";
import SiteIcon from "./SiteIcon";
import cal from "./calendar.module.css";
import styles from "./owner.module.css";

type Kind = CalendarEntry["kind"] | "clash";
const SITES = ["airbnb", "booking", "vrbo"] as const;

// Dates are handled as "YYYY-MM-DD" strings in the cottage's own calendar days.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const addMonths = (s: string, n: number) => {
  const d = parse(s);
  return iso(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
};
const key = (e: CalendarEntry) => `${e.kind}-${e.id}`;
const covers = (e: CalendarEntry, day: string) => e.start <= day && day < e.end;

/** Days of the month in Monday-first weeks; null pads the first week. */
function monthGrid(first: string): (string | null)[] {
  const d = parse(first);
  const lead = (d.getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
}

export default function OwnerCalendar({
  lang,
  t,
  np,
  languageButton,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  /** Prices per night: the words from the listing editor's messages. */
  np: Messages["listings"]["nightPrices"];
  languageButton: React.ReactNode;
}) {
  const c = t.calendar;
  const intl = LANG_INFO[lang].intl;
  const [data, setData] = useState<CalendarData | null>(null);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [cottageId, setCottageId] = useState<number | null>(null);
  const [owner, setOwner] = useState("");
  const [pick, setPick] = useState<{ start: string; end?: string } | null>(null);
  const [pickError, setPickError] = useState("");
  const [note, setNote] = useState("");
  const [shownDay, setShownDay] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [priceNote, setPriceNote] = useState("");

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof SignedOut) window.location.replace(paths.hostingLogin(lang));
      else setFailed(true);
    },
    [lang],
  );

  const load = useCallback(
    async (from: string) => {
      try {
        const res = await ownerApi.calendar(from, 2);
        setData(res);
        setFailed(false);
        // ?cottage=<id> opens that cottage (from the listing editor); otherwise the first.
        const wanted = Number(new URLSearchParams(window.location.search).get("cottage"));
        setCottageId((id) => id ?? res.cottages.find((x) => x.id === wanted)?.id ?? res.cottages[0]?.id ?? null);
      } catch (err) {
        fail(err);
      }
    },
    [fail],
  );

  useEffect(() => {
    const first = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
    const timer = window.setTimeout(() => {
      setMonth(first);
      ownerApi.me().then((me) => setOwner(me.name), () => undefined);
      void load(first);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Opened from the "new booking request" email: bring that request into view.
  useEffect(() => {
    if (!data) return;
    const wanted = new URLSearchParams(window.location.search).get("request");
    if (wanted) document.getElementById(`request-${wanted}`)?.scrollIntoView({ block: "center" });
  }, [data]);

  const fmt = useMemo(() => {
    const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" });
    const short = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
    const long = new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" });
    const stamp = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const weekday = new Intl.DateTimeFormat(intl, { weekday: "short" });
    return {
      month: (s: string) => monthName.format(parse(s)),
      short: (s: string) => short.format(parse(s)),
      long: (s: string) => long.format(parse(s)),
      stamp: (s: string) => stamp.format(new Date(s)),
      // 1 January 2024 was a Monday.
      weekdays: Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2024, 0, 1 + i, 12))),
      range: (a: string, b: string) => `${short.format(parse(a))} – ${short.format(parse(b))}`,
    };
  }, [intl]);

  const cottage = data?.cottages.find((x) => x.id === cottageId) ?? null;
  const entries = useMemo(
    () => (data && cottage ? data.entries.filter((e) => e.cottage_id === cottage.id) : []),
    [data, cottage],
  );
  const clashing = useMemo(() => new Set((data?.conflicts ?? []).flat()), [data]);
  const clashPairs = useMemo(() => data?.conflicts ?? [], [data]);

  const dayKind = useCallback(
    (day: string): { kind: Kind | null; first: boolean; last: boolean; items: CalendarEntry[] } => {
      const items = entries.filter((e) => covers(e, day));
      const byKey = new Set(items.map(key));
      const clash = clashPairs.some(([a, b]) => byKey.has(a) && byKey.has(b));
      const main =
        items.find((e) => e.kind === "booking") ??
        items.find((e) => e.kind === "site") ??
        items.find((e) => e.kind === "block") ??
        items.find((e) => e.kind === "request");
      return {
        kind: clash ? "clash" : main?.kind ?? null,
        first: !!main && main.start === day,
        last: !!main && addDays(main.end, -1) === day,
        items,
      };
    },
    [entries, clashPairs],
  );

  const isBusy = (day: string) => entries.some((e) => e.kind !== "request" && covers(e, day));

  function chooseDay(day: string) {
    setPickError("");
    const { items } = dayKind(day);
    if (items.some((e) => e.kind !== "request")) {
      setPick(null);
      setShownDay(day === shownDay ? null : day);
      return;
    }
    setShownDay(items.length ? day : null);
    if (!pick || pick.end || day < pick.start) {
      setPick({ start: day });
      return;
    }
    for (let d = pick.start; d <= day; d = addDays(d, 1)) {
      if (isBusy(d)) {
        setPickError(c.pick.busy);
        setPick({ start: day });
        return;
      }
    }
    setPick({ start: pick.start, end: day });
    setShownDay(null);
  }

  async function closeDates() {
    if (!cottage || !pick?.end || !month) return;
    setWorking(true);
    try {
      await ownerApi.closeDates(cottage.id, pick.start, addDays(pick.end, 1), note.trim());
      setPick(null);
      setNote("");
      await load(month);
    } catch (err) {
      fail(err);
    } finally {
      setWorking(false);
    }
  }

  async function savePrice(price: string | null) {
    if (!cottage || !pick?.end || !month) return;
    const value = price === null ? null : Number(price.replace(",", "."));
    if (value !== null && !(value >= 1)) return setPriceNote(np.failed);
    setWorking(true);
    setPriceNote("");
    try {
      await ownerApi.setPrices(cottage.id, pick.start, addDays(pick.end, 1), value === null ? null : value.toFixed(2));
      setPick(null);
      setPriceText("");
      await load(month);
    } catch (err) {
      if (err instanceof SignedOut) fail(err);
      else setPriceNote(np.failed);
    } finally {
      setWorking(false);
    }
  }

  async function reopen(id: number) {
    if (!month) return;
    setWorking(true);
    try {
      await ownerApi.reopenDates(id);
      setShownDay(null);
      await load(month);
    } catch (err) {
      fail(err);
    } finally {
      setWorking(false);
    }
  }

  function go(n: number) {
    if (!month) return;
    const next = n === 0 ? iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12)) : addMonths(month, n);
    setMonth(next);
    setShownDay(null);
    void load(next);
  }

  const updateCottage = (row: CalendarCottage) =>
    setData((d) => (d ? { ...d, cottages: d.cottages.map((x) => (x.id === row.id ? { ...x, ...row } : x)) } : d));
  const updateFeed = (feed: CalendarFeed | null, channel: string) =>
    setData((d) =>
      d && cottage
        ? {
            ...d,
            cottages: d.cottages.map((x) =>
              x.id === cottage.id
                ? { ...x, feeds: [...x.feeds.filter((f) => f.channel !== channel), ...(feed ? [feed] : [])] }
                : x,
            ),
          }
        : d,
    );

  const header = <HostingHeader lang={lang} t={t} languageButton={languageButton} active="calendar" ownerName={owner} />;

  if (!data || !month) {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          {failed ? (
            <div className={styles.errorBox} role="alert">
              <p>{t.error}</p>
              <button type="button" className={styles.primary} onClick={() => month && load(month)}>
                {t.retry}
              </button>
            </div>
          ) : (
            <div className={styles.skeleton} aria-busy="true" aria-label={t.loading}>
              <span />
              <span />
              <span />
            </div>
          )}
        </main>
      </div>
    );
  }

  const today = data.today;
  const cottageName = (id: number) => data.cottages.find((x) => x.id === id)?.name ?? "";
  const requests = data.requests;
  const legend: [Kind, string][] = [
    ["booking", c.legend.booking],
    ["site", c.legend.site],
    ["block", c.legend.block],
    ["request", c.legend.request],
    ["clash", c.legend.clash],
  ];
  const kindLabel = (k: Kind | null) => (k ? Object.fromEntries(legend)[k] : "");
  const shown = shownDay ? dayKind(shownDay).items : [];
  const prices = cottage ? data?.prices?.[String(cottage.id)] : undefined;
  const nights = new Map<string, NightPriceRow>((prices?.nights ?? []).map((n) => [n.date, n]));
  const money = (v: string | number) => (prices && isCurrency(prices.currency) ? formatPrice(lang, Number(v), prices.currency) : `${Number(v)} ${prices?.currency ?? ""}`);
  const picked: NightPriceRow[] = [];
  if (pick?.end) for (let d = pick.start; d <= pick.end; d = addDays(d, 1)) if (nights.has(d)) picked.push(nights.get(d)!);
  const low = Math.min(...picked.map((n) => Number(n.price)));
  const high = Math.max(...picked.map((n) => Number(n.price)));
  const reasons = [...new Set(picked.flatMap((n) => n.reasons))].filter((r) => r !== "smart").map((r) => np.reasons[r]);
  const nightsPicked = pick?.end ? Math.round((parse(pick.end).getTime() - parse(pick.start).getTime()) / 86_400_000) + 1 : 0;

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.main}>
        <div className={styles.intro}>
          <div>
            <h1>{c.title}</h1>
            <p>{c.lead}</p>
          </div>
          {data.cottages.length > 1 ? (
            <label className={cal.cottagePick}>
              <span>{c.cottage}</span>
              <select
                value={cottageId ?? ""}
                onChange={(e) => {
                  setCottageId(Number(e.target.value));
                  setPick(null);
                  setShownDay(null);
                }}
              >
                {data.cottages.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {!cottage ? (
          <p className={styles.note}>{c.empty}</p>
        ) : (
          <>
            {requests.length ? (
              <section className={styles.section} aria-labelledby="requests-title">
                <h2 id="requests-title">{c.requests.title}</h2>
                <p className={styles.lead}>{c.requests.lead}</p>
                <div className={cal.requests}>
                  {requests.map((r) => (
                    <div key={r.id} id={`request-${r.id}`}>
                      <RequestCard
                        lang={lang}
                        t={c.requests}
                        nightsWord={t.nights}
                        req={r}
                        cottage={data.cottages.length > 1 ? cottageName(r.cottage_id) : undefined}
                        onDone={() => void load(month)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={`${styles.section} ${styles.card}`} aria-labelledby="calendar-title">
              <div className={cal.toolbar}>
                <h2 id="calendar-title">{cottage.name}</h2>
                <div className={cal.nav}>
                  <button type="button" className={cal.navBtn} aria-label={c.prev} onClick={() => go(-1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
                  </button>
                  <button type="button" className={cal.todayBtn} onClick={() => go(0)}>
                    {c.today}
                  </button>
                  <button type="button" className={cal.navBtn} aria-label={c.next} onClick={() => go(1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                  </button>
                </div>
              </div>

              <div className={cal.months}>
                {[month, addMonths(month, 1)].map((m) => (
                  <div key={m} className={cal.month}>
                    <h3>{fmt.month(m)}</h3>
                    <div className={cal.grid} role="grid" aria-label={fmt.month(m)}>
                      {fmt.weekdays.map((w) => (
                        <span key={w} className={cal.weekday} role="columnheader">
                          {w}
                        </span>
                      ))}
                      {monthGrid(m).map((day, i) => {
                        if (!day) return <span key={`pad-${i}`} />;
                        const k = dayKind(day);
                        const past = day < today;
                        const picked = !!pick && (pick.end ? pick.start <= day && day <= pick.end : day === pick.start);
                        const night = !k.kind && !past ? nights.get(day) : undefined;
                        return (
                          <button
                            key={day}
                            type="button"
                            role="gridcell"
                            className={cal.day}
                            data-kind={k.kind ?? undefined}
                            data-first={k.first || undefined}
                            data-last={k.last || undefined}
                            data-today={day === today || undefined}
                            data-picked={picked || undefined}
                            data-shown={day === shownDay || undefined}
                            disabled={past && !k.items.length}
                            aria-selected={picked}
                            aria-label={`${fmt.long(day)}${k.kind ? `: ${kindLabel(k.kind)}` : ""}${night ? `, ${money(night.price)}` : ""}`}
                            onClick={() => chooseDay(day)}
                          >
                            {parse(day).getDate()}
                            {night ? (
                              <span className={cal.price} data-source={night.override ? "custom" : night.reasons.includes("smart") ? "smart" : undefined} aria-hidden="true">
                                {Math.round(Number(night.price)).toLocaleString(intl)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <ul className={cal.legend}>
                {legend.map(([k, label]) => (
                  <li key={k}>
                    <span className={cal.swatch} data-kind={k} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>

              {prices ? (
                <p className={cal.priceKey}>
                  {fill(lang, np.newPrice, { currency: prices.currency })}: <span data-source="smart">{np.smart}</span> ·{" "}
                  <span data-source="custom">{np.custom}</span> · <span>{np.usual}</span>
                </p>
              ) : null}

              <div className={cal.panel} aria-live="polite">
                {pick?.end ? (
                  <div className={cal.panelBox}>
                    <strong>{fill(lang, c.pick.title, { dates: fmt.range(pick.start, addDays(pick.end, 1)) })}</strong>
                    <span className={styles.muted}>{plural(lang, t.nights, nightsPicked)}</span>
                    <label className={cal.noteField}>
                      <span>{c.pick.note}</span>
                      <input value={note} maxLength={200} placeholder={c.pick.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    {prices && pick.start >= today && picked.length ? (
                      <div className={cal.priceBox}>
                        <span>
                          <strong>{low === high ? money(low) : `${money(low)} – ${money(high)}`}</strong>{" "}
                          <span className={styles.muted}>
                            {[picked.some((n) => n.override) ? np.custom : prices.smart_pricing ? np.smart : np.usual, ...reasons].join(" · ")}
                          </span>
                        </span>
                        {!prices.smart_pricing && picked.length === 1 && picked[0].suggested !== picked[0].price ? (
                          <button type="button" className={cal.textLink} onClick={() => setPriceText(String(Number(picked[0].suggested)))}>
                            {fill(lang, np.suggested, { price: money(picked[0].suggested) })}
                          </button>
                        ) : null}
                        <label className={cal.noteField}>
                          <span>{fill(lang, np.newPrice, { currency: prices.currency })}</span>
                          <input type="number" inputMode="decimal" min={1} step="1" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
                        </label>
                        <div className={cal.panelActions}>
                          <button type="button" className={cal.outlineBtn} disabled={working || !priceText.trim()} onClick={() => savePrice(priceText)}>
                            {np.save}
                          </button>
                          {picked.some((n) => n.override) ? (
                            <button type="button" className={cal.textLink} disabled={working} onClick={() => savePrice(null)}>
                              {np.automatic}
                            </button>
                          ) : null}
                        </div>
                        {priceNote ? <p className={cal.clashNote}>{priceNote}</p> : null}
                      </div>
                    ) : null}
                    <div className={cal.panelActions}>
                      <button type="button" className={cal.primaryBtn} disabled={working} onClick={closeDates}>
                        {working ? c.pick.closing : c.pick.close}
                      </button>
                      <button type="button" className={cal.outlineBtn} onClick={() => setPick(null)}>
                        {c.pick.cancel}
                      </button>
                    </div>
                  </div>
                ) : shown.length ? (
                  <div className={cal.panelBox}>
                    <strong>{fmt.long(shownDay!)}</strong>
                    {shown.some((e) => clashing.has(key(e))) && shown.filter((e) => e.kind !== "request").length > 1 ? (
                      <p className={cal.clashNote}>{c.entry.clash}</p>
                    ) : null}
                    <ul className={cal.entryList}>
                      {shown.map((e) => (
                        <li key={key(e)}>
                          <span className={cal.swatch} data-kind={e.kind} aria-hidden="true" />
                          <span className={cal.entryText}>
                            <strong>
                              {e.kind === "block"
                                ? c.entry.block
                                : e.kind === "request"
                                  ? fill(lang, c.entry.request, { name: e.label })
                                  : e.kind === "site"
                                    ? fill(lang, c.entry.site, { site: e.label })
                                    : fill(lang, c.entry.booking, { site: e.channel === "owner" ? t.ownBooking : e.label })}
                            </strong>
                            <span className={styles.muted}>
                              {fmt.range(e.start, e.end)}
                              {e.guests ? ` · ${e.guests}` : ""}
                              {e.note && e.kind === "block" ? ` · ${e.note}` : ""}
                            </span>
                            {e.kind === "site" ? <span className={styles.muted}>{fill(lang, c.entry.siteNote, { site: e.label })}</span> : null}
                          </span>
                          {e.kind === "block" ? (
                            <button type="button" className={cal.outlineBtn} disabled={working} onClick={() => reopen(e.id)}>
                              {working ? c.entry.reopening : c.entry.reopen}
                            </button>
                          ) : e.kind === "request" ? (
                            <a className={cal.textLink} href={`#request-${e.id}`}>
                              {c.requests.title}
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <button type="button" className={cal.textLink} onClick={() => setShownDay(null)}>
                      {c.entry.close}
                    </button>
                  </div>
                ) : (
                  <p className={cal.hint}>
                    {pickError || (pick ? fill(lang, c.pick.start, { date: fmt.short(pick.start) }) : c.pick.hint)}
                  </p>
                )}
              </div>
            </section>

            <BookingLink lang={lang} t={c.link} cottage={cottage} onChange={updateCottage} onFail={fail} />
            <SiteLinks
              lang={lang}
              t={c.sites}
              copyWords={c.link}
              ownBooking={t.ownBooking}
              cottage={cottage}
              stamp={fmt.stamp}
              onFeed={updateFeed}
              onFail={fail}
            />
          </>
        )}
      </main>
    </div>
  );
}

function CopyField({ value, copy, copied, label }: { value: string; copy: string; copied: string; label: string }) {
  const [done, setDone] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      // no clipboard access: the text is selectable
    }
  }
  return (
    <div className={cal.copyField}>
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className={cal.outlineBtn} onClick={doCopy}>
        {done ? copied : copy}
      </button>
    </div>
  );
}

function BookingLink({
  t,
  cottage,
  onChange,
  onFail,
}: {
  lang: Lang;
  t: Messages["dashboard"]["calendar"]["link"];
  cottage: CalendarCottage;
  onChange: (c: CalendarCottage) => void;
  onFail: (err: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<CalendarCottage>) {
    setBusy(true);
    try {
      onChange(await fn());
    } catch (err) {
      onFail(err);
    } finally {
      setBusy(false);
    }
  }
  const open = cottage.booking_requests_open;
  return (
    <section className={`${styles.section} ${styles.card}`} aria-labelledby="link-title">
      <div className={cal.cardHead}>
        <h2 id="link-title">{t.title}</h2>
        <span className={cal.status} data-on={open}>
          {open ? t.on : t.off}
        </span>
      </div>
      <p className={styles.lead}>{t.lead}</p>
      <CopyField value={cottage.booking_link} copy={t.copy} copied={t.copied} label={t.title} />
      <div className={cal.linkActions}>
        <a className={cal.textLink} href={cottage.booking_link} target="_blank" rel="noopener">
          {t.view}
        </a>
        <button
          type="button"
          className={cal.textLink}
          disabled={busy}
          onClick={() => run(() => ownerApi.setBookingLink(cottage.id, !open))}
        >
          {open ? t.turnOff : t.turnOn}
        </button>
        <button
          type="button"
          className={cal.textLink}
          disabled={busy}
          onClick={() => window.confirm(t.renewConfirm) && run(() => ownerApi.renewBookingLink(cottage.id))}
        >
          {t.renew}
        </button>
      </div>
    </section>
  );
}

type CopyWords = { copy: string; copied: string };

function SiteLinks({
  lang,
  t,
  copyWords,
  ownBooking,
  cottage,
  stamp,
  onFeed,
  onFail,
}: {
  lang: Lang;
  t: Messages["dashboard"]["calendar"]["sites"];
  copyWords: CopyWords;
  ownBooking: string;
  cottage: CalendarCottage;
  stamp: (iso: string) => string;
  onFeed: (feed: CalendarFeed | null, channel: string) => void;
  onFail: (err: unknown) => void;
}) {
  return (
    <section className={`${styles.section} ${styles.card}`} aria-labelledby="sites-title">
      <h2 id="sites-title">{t.title}</h2>
      <p className={styles.lead}>{t.lead}</p>
      <div className={cal.sites}>
        {SITES.map((site) => (
          <SiteRow
            key={`${cottage.id}-${site}`}
            lang={lang}
            t={t}
            copyWords={copyWords}
            ownBooking={ownBooking}
            cottage={cottage}
            site={site}
            stamp={stamp}
            onFeed={onFeed}
            onFail={onFail}
          />
        ))}
        <div className={cal.site}>
          <SiteIcon channel="nettimokki" label="Nettimökki" ownBooking={ownBooking} />
          <p className={styles.muted}>{fill(lang, t.nettimokki, { address: cottage.forwarding_address })}</p>
        </div>
      </div>
    </section>
  );
}

function SiteRow({
  lang,
  t,
  copyWords,
  ownBooking,
  cottage,
  site,
  stamp,
  onFeed,
  onFail,
}: {
  lang: Lang;
  t: Messages["dashboard"]["calendar"]["sites"];
  copyWords: CopyWords;
  ownBooking: string;
  cottage: CalendarCottage;
  site: (typeof SITES)[number];
  stamp: (iso: string) => string;
  onFeed: (feed: CalendarFeed | null, channel: string) => void;
  onFail: (err: unknown) => void;
}) {
  const feed = cottage.feeds.find((f) => f.channel === site) ?? null;
  const [url, setUrl] = useState(feed?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo" }[site];

  async function save() {
    if (!url.trim().toLowerCase().startsWith("https://")) {
      setError(t.https);
      return;
    }
    setBusy(true);
    setError("");
    try {
      onFeed(await ownerApi.saveFeed(cottage.id, site, url.trim()), site);
    } catch (err) {
      if ((err as { status?: number }).status === 400) setError(t.https);
      else onFail(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!feed) return;
    setBusy(true);
    try {
      await ownerApi.removeFeed(feed.id);
      onFeed(null, site);
      setUrl("");
    } catch (err) {
      onFail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cal.site}>
      <SiteIcon channel={site} label={name} ownBooking={ownBooking} />
      <div className={cal.step}>
        <strong>{fill(lang, t.ours, { site: name })}</strong>
        <span className={styles.muted}>{fill(lang, t.oursHelp, { site: name })}</span>
        <CopyField
          value={cottage.export[site]}
          copy={copyWords.copy}
          copied={copyWords.copied}
          label={fill(lang, t.ours, { site: name })}
        />
      </div>
      <div className={cal.step}>
        <strong>{fill(lang, t.theirs, { site: name })}</strong>
        <span className={styles.muted}>{fill(lang, t.theirsHelp, { site: name })}</span>
        <div className={cal.copyField}>
          <input
            value={url}
            inputMode="url"
            placeholder={t.placeholder}
            aria-label={fill(lang, t.theirs, { site: name })}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="button" className={cal.primaryBtn} disabled={busy || !url.trim() || url.trim() === feed?.url} onClick={save}>
            {busy ? t.saving : t.save}
          </button>
        </div>
        {error ? (
          <span className={cal.error} role="alert">
            {error}
          </span>
        ) : feed ? (
          <span className={feed.last_error ? cal.error : styles.muted}>
            {feed.last_error ? t.error : feed.last_synced_at ? fill(lang, t.read, { when: stamp(feed.last_synced_at) }) : t.notRead}
            {" · "}
            <button type="button" className={cal.textLink} disabled={busy} onClick={remove}>
              {t.remove}
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
