"use client";

import "react-day-picker/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import type { Messages } from "@/i18n";
import { countryName, fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CANCELLATION } from "@/i18n/messages/cancellation";
import { DEFAULT_LONG_POLICY, DEFAULT_POLICY, guestLines, isLongPolicy, isPolicy, LONG_STAY_NIGHTS } from "@/lib/cancellation";
import { formatPrice, isCurrency } from "@/lib/currency";
import { type BookingLinkInfo, guestApi, type StayQuote } from "@/lib/ownerApi";
import { CALENDAR_LOCALES } from "./guest/Pickers";
import { Wordmark } from "./guest/icons";
import RatingsSection, { RatingBadge } from "./Ratings";
import chat from "./chat.module.css";
import styles from "./book.module.css";

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; info: BookingLinkInfo; busy: Set<string> };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
const nightsBetween = (a: Date, b: Date) => Math.round((parse(iso(b)).getTime() - parse(iso(a)).getTime()) / 86_400_000);

/** Every busy night as "YYYY-MM-DD"; a range's end day (check-out) stays free. */
function busyNights(ranges: [string, string][]): Set<string> {
  const out = new Set<string>();
  for (const [start, end] of ranges) {
    for (let d = parse(start); iso(d) < end; d.setDate(d.getDate() + 1)) out.add(iso(d));
  }
  return out;
}

function Count({
  label,
  value,
  min,
  max,
  less,
  more,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  less: string;
  more: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className={styles.count}>
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`${less}: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output aria-live="polite" aria-label={label}>
          {value}
        </output>
        <button type="button" aria-label={`${more}: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

/** The page behind an owner's booking link: free dates, guests, the owner's price and a request form. */
export default function BookingRequest({
  lang,
  token,
  t,
  languageButton,
}: {
  lang: Lang;
  token: string;
  t: Messages["book"];
  languageButton: React.ReactNode;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [range, setRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [months, setMonths] = useState(2);
  const [message, setMessage] = useState(t.form.messageDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sentToken, setSentToken] = useState<string | null>(null);
  // The stay's price from the server: each night's own price (seasons, weekends, smart pricing), discounts and cleaning.
  const [quote, setQuote] = useState<{ key: string; q: StayQuote } | null>(null);
  const quoteKey = range?.from && range.to ? `${iso(range.from)}|${iso(range.to)}` : null;
  useEffect(() => {
    if (!quoteKey) return;
    const [a, z] = quoteKey.split("|");
    let live = true;
    guestApi.quote(token, a, z).then(
      (q) => {
        if (live) setQuote({ key: quoteKey, q });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [token, quoteKey]);

  const fetchInfo = useCallback(async () => {
    try {
      const info = await guestApi.bookingLink(token);
      setLoad({ state: "ready", info, busy: busyNights(info.busy) });
    } catch (err) {
      setLoad({ state: (err as { status?: number }).status === 404 ? "missing" : "error" });
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMonths(window.innerWidth < 760 ? 1 : 2);
      void fetchInfo();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchInfo]);

  const header = (
    <header className={chat.guestTop}>
      <a className={chat.brand} href={paths.home(lang)}>
        <Wordmark />
      </a>
      {languageButton}
    </header>
  );

  const ready = load.state === "ready" ? load : null;
  const today = ready ? parse(ready.info.today) : null;

  // While choosing check-out: nothing past the next busy night (that night itself is the check-out day).
  const firstBusyAfter = useMemo(() => {
    if (!ready || !range?.from || range.to) return null;
    const from = iso(range.from);
    let first: string | null = null;
    for (const night of ready.busy) if (night > from && (!first || night < first)) first = night;
    return first;
  }, [ready, range]);

  const disabled = useCallback(
    (day: Date) => {
      if (!ready || !today) return true;
      const d = iso(day);
      if (d < iso(today)) return true;
      if (range?.from && !range.to && d > iso(range.from)) {
        if (nightsBetween(range.from, day) > ready.info.max_nights) return true;
        return firstBusyAfter !== null && d > firstBusyAfter;
      }
      return ready.busy.has(d);
    },
    [ready, today, range, firstBusyAfter],
  );

  function select(_r: DateRange | undefined, day: Date) {
    if (!ready || disabled(day)) return;
    setErrors((e) => ({ ...e, dates: "" }));
    if (!range?.from || range.to || iso(day) <= iso(range.from)) {
      if (!ready.busy.has(iso(day))) setRange({ from: day, to: undefined });
      return;
    }
    setRange({ from: range.from, to: day });
  }

  if (!ready) {
    return (
      <div className={chat.guestPage}>
        {header}
        <main className={chat.guestMain}>
          <p className={chat.note} aria-busy={load.state === "loading"}>
            {load.state === "loading" ? "…" : load.state === "missing" ? t.errors.notFound : t.errors.load}
          </p>
        </main>
      </div>
    );
  }

  const info = ready.info;
  const currency = isCurrency(info.currency) ? info.currency : "EUR";
  const price = (n: number) => formatPrice(lang, n, currency);
  const nights = range?.from && range.to ? nightsBetween(range.from, range.to) : 0;
  const q = quote && quote.key === quoteKey ? quote.q : null;
  const each = q ? q.nights.map((n) => Number(n.price)) : [];
  const even = !q || each.every((x) => x === each[0]);
  const stay = q ? Number(q.subtotal) : nights * Number(info.price_per_night);
  const cleaning = q ? Number(q.cleaning_fee) : Number(info.cleaning_fee);
  const discount = q ? Number(q.discount) : 0;
  const total = q ? Number(q.total) : stay + cleaning;
  const tooShort = nights > 0 && nights < info.min_nights;
  const place = [info.municipality, countryName(lang, info.country)].filter(Boolean).join(", ");
  const dayFmt = new Intl.DateTimeFormat(LANG_INFO[lang].intl, { weekday: "short", day: "numeric", month: "short" });

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const found: Record<string, string> = {};
    if (!range?.from || !range.to) found.dates = t.form.noDates;
    else if (tooShort) found.dates = plural(lang, t.minNights, info.min_nights);
    if (!name) found.name = t.errors.required;
    if (!email) found.email = t.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = t.errors.email;
    if (!message.trim()) found.message = t.errors.required;
    setErrors(found);
    if (Object.keys(found).length || !range?.from || !range.to) return;
    setSending(true);
    try {
      const res = await guestApi.requestBooking(token, {
        name,
        email,
        phone: String(form.get("phone") ?? "").trim(),
        lang,
        check_in: iso(range.from),
        check_out: iso(range.to),
        adults,
        children,
        body: message.trim(),
        website: String(form.get("website") ?? ""),
      });
      setSentToken(res.token);
    } catch (err) {
      const { status, body } = err as { status?: number; body?: { detail?: string; email?: unknown } };
      const code = body?.detail as keyof typeof t.errors | undefined;
      if (status === 429) setErrors({ form: t.errors.tooMany });
      else if (body?.email) setErrors({ email: t.errors.email });
      else if (code && code in t.errors) {
        setErrors({ form: t.errors[code] });
        if (code === "taken") void fetchInfo().then(() => setRange(undefined));
      } else setErrors({ form: t.errors.failed });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={chat.guestPage}>
      {header}
      <main className={styles.main}>
        <div className={styles.head}>
          <h1>{info.name}</h1>
          <p>
            {[place, info.host ? fill(lang, t.host, { name: info.host }) : ""].filter(Boolean).join(" · ")}
          </p>
          {info.ratings ? (
            <p>
              <RatingBadge lang={lang} ratings={info.ratings} />
            </p>
          ) : null}
        </div>

        {sentToken ? (
          <section className={styles.done} role="status">
            <h2>{t.sent.title}</h2>
            <p>{fill(lang, t.sent.body, { host: info.host || "Rantio" })}</p>
            <a className={styles.sendBtn} href={paths.guestChat(lang, sentToken)}>
              {t.sent.open}
            </a>
          </section>
        ) : !info.open ? (
          <section className={styles.done}>
            <h2>{t.closed.title}</h2>
            <p>{fill(lang, t.closed.body, { host: info.host || "Rantio" })}</p>
          </section>
        ) : (
          <form className={styles.layout} onSubmit={send} noValidate>
            <div className={styles.left}>
              <section className={styles.block} aria-labelledby="dates-title">
                <div className={styles.blockHead}>
                  <h2 id="dates-title">{t.dates}</h2>
                  <span>{plural(lang, t.minNights, info.min_nights)}</span>
                </div>
                <p className={styles.datesLine} aria-live="polite">
                  {range?.from && range.to
                    ? `${dayFmt.format(range.from)} – ${dayFmt.format(range.to)} · ${plural(lang, t.nights, nights)}`
                    : range?.from
                      ? t.pickOut
                      : t.pickIn}
                </p>
                <DayPicker
                  mode="range"
                  locale={CALENDAR_LOCALES[lang]}
                  numberOfMonths={months}
                  pagedNavigation
                  weekStartsOn={1}
                  startMonth={today!}
                  defaultMonth={today!}
                  selected={range}
                  onSelect={select}
                  disabled={disabled}
                  className={styles.picker}
                />
                {range?.from ? (
                  <button type="button" className={styles.textBtn} onClick={() => setRange(undefined)}>
                    {t.clear}
                  </button>
                ) : null}
                {errors.dates ? <p className={styles.error}>{errors.dates}</p> : null}
              </section>

              <section className={styles.block} aria-labelledby="guests-title">
                <div className={styles.blockHead}>
                  <h2 id="guests-title">{t.guests}</h2>
                  <span>{fill(lang, t.maxGuests, { n: info.max_guests })}</span>
                </div>
                <Count label={t.adults} value={adults} min={1} max={info.max_guests - children} less={t.less} more={t.more} onChange={setAdults} />
                <Count label={t.children} value={children} min={0} max={info.max_guests - adults} less={t.less} more={t.more} onChange={setChildren} />
              </section>

              <section className={styles.block} aria-labelledby="details-title">
                <h2 id="details-title">{t.form.title}</h2>
                <label className={styles.field}>
                  <span>{t.form.name}</span>
                  <input name="name" autoComplete="name" maxLength={120} aria-invalid={!!errors.name} />
                  {errors.name ? <em>{errors.name}</em> : null}
                </label>
                <label className={styles.field}>
                  <span>{t.form.email}</span>
                  <input name="email" type="email" autoComplete="email" maxLength={254} aria-invalid={!!errors.email} />
                  {errors.email ? <em>{errors.email}</em> : <small>{t.form.emailNote}</small>}
                </label>
                <label className={styles.field}>
                  <span>
                    {t.form.phone} <i>({t.form.optional})</i>
                  </span>
                  <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
                </label>
                <label className={styles.field}>
                  <span>{t.form.message}</span>
                  <textarea rows={4} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.message} />
                  {errors.message ? <em>{errors.message}</em> : null}
                </label>
                <input className={styles.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              </section>
            </div>

            <aside className={styles.summary}>
              <p className={styles.nightly}>
                {fill(lang, t.perNight, { price: price(Number(info.price_per_night)) })}
              </p>
              {nights > 0 ? (
                <dl className={styles.lines}>
                  <div>
                    <dt>
                      {even
                        ? fill(lang, t.price.nights, { price: price(q ? each[0] : Number(info.price_per_night)), nights: plural(lang, t.nights, nights) })
                        : plural(lang, t.nights, nights)}
                    </dt>
                    <dd>{price(stay)}</dd>
                  </div>
                  {discount ? (
                    <div>
                      <dt>{fill(lang, t.price.discount, { pct: q?.discount_percent ?? 0 })}</dt>
                      <dd>−{price(discount)}</dd>
                    </div>
                  ) : null}
                  {cleaning ? (
                    <div>
                      <dt>{t.price.cleaning}</dt>
                      <dd>{price(cleaning)}</dd>
                    </div>
                  ) : null}
                  <div className={styles.total}>
                    <dt>{t.price.total}</dt>
                    <dd>{price(total)}</dd>
                  </div>
                </dl>
              ) : null}
              {errors.form ? (
                <p className={styles.error} role="alert">
                  {errors.form}
                </p>
              ) : null}
              <button type="submit" className={styles.sendBtn} disabled={sending}>
                {sending ? t.form.sending : t.form.send}
              </button>
              <p className={styles.small}>{t.price.note}</p>
              <div className={styles.cancellation}>
                <h3>{CANCELLATION[lang].title}</h3>
                {guestLines(CANCELLATION[lang], {
                  policy: isPolicy(info.cancellation_policy) ? info.cancellation_policy : DEFAULT_POLICY,
                  longPolicy: isLongPolicy(info.long_stay_policy) ? info.long_stay_policy : DEFAULT_LONG_POLICY,
                  checkIn: range?.from && range.to ? iso(range.from) : null,
                  nights,
                  today: info.today,
                  time: info.check_in_from ?? "15:00",
                  day: (d) => new Intl.DateTimeFormat(LANG_INFO[lang].intl, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00Z`)),
                }).map((line) => (
                  <p key={line} className={styles.small}>
                    {line}
                  </p>
                ))}
                {nights < LONG_STAY_NIGHTS ? <p className={styles.small}>{CANCELLATION[lang].window}</p> : null}
              </div>
            </aside>
          </form>
        )}
        {info.ratings ? <RatingsSection lang={lang} ratings={info.ratings} host={info.host} /> : null}
      </main>
    </div>
  );
}
