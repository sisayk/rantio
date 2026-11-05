"use client";

import { useEffect, useMemo, useState } from "react";
import { fill, number } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { EVENTS } from "@/i18n/messages/events";
import { formatPrice, isCurrency } from "@/lib/currency";
import { External, Heart } from "./icons";
import styles from "./guest.module.css";

type Interest = keyof (typeof EVENTS)["en"]["interests"];
type EventItem = {
  id: string;
  source: string;
  name: string;
  start: string;
  end: string | null;
  all_day: boolean;
  venue: string;
  km: number;
  description: string;
  url: string;
  price: { free: boolean | null; text: string; min: number | null; max: number | null; currency: string };
  interests: Interest[];
  sponsored?: boolean; // the link carries Rantio's affiliate tag
};
type Answer = { events: EventItem[]; sources: string[]; covered: boolean; affiliate?: boolean };
type State = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; answer: Answer };

const SAVED_KEY = "rantio.savedEvents.v1";
// Times show in the cottage's own time, wherever the guest is reading from.
const ZONES: Record<string, string> = {
  FI: "Europe/Helsinki", SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  IS: "Atlantic/Reykjavik", EE: "Europe/Tallinn", LV: "Europe/Riga", LT: "Europe/Vilnius",
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function readSaved(): Record<string, EventItem> {
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, EventItem>;
  } catch {
    return {};
  }
}

/** Events near the cottage during the guest's stay, above the places nearby. The stay comes
 *  from the page address (?from=…&to=…, as the search passes it), or the guest adds it here. */
export default function NearbyEvents({ lang, lat, lng, country }: { lang: Lang; lat: number; lng: number; country: string }) {
  const t = EVENTS[lang];
  const [stay, setStay] = useState<{ from: string; to: string } | null>(null);
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [today, setToday] = useState("");
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [interest, setInterest] = useState<Interest | "all" | "saved">("all");
  const [saved, setSaved] = useState<Record<string, EventItem>>({});

  // The stay and the saved events live in the browser: read them once the page is here.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const from = q.get("from") ?? "";
    const to = q.get("to") ?? "";
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    /* eslint-disable react-hooks/set-state-in-effect -- reading the address and storage once */
    setToday(iso);
    setSaved(readSaved());
    if (DAY.test(from) && DAY.test(to) && to >= from && to >= iso) {
      setStay({ from, to });
      setDraft({ from, to });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!stay) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ lat: lat.toFixed(4), lng: lng.toFixed(4), from: stay.from, to: stay.to, lang });
    fetch(`/api/events/?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Answer>) : Promise.reject(new Error(String(r.status)))))
      .then((answer) => setState({ status: "ready", answer }))
      .catch(() => !ctrl.signal.aborted && setState({ status: "error" }));
    return () => ctrl.abort();
  }, [stay, lat, lng, lang]);

  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    const timeZone = ZONES[country] ?? "Europe/Helsinki";
    return {
      day: new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone }),
      time: new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", timeZone }),
      short: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone }),
      // the stay's own days, which are calendar days with no time zone of their own
      stayDay: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" }),
      dayKey: new Intl.DateTimeFormat("en-CA", { timeZone }),
    };
  }, [lang, country]);

  function showStay(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.from || !draft.to || draft.to < draft.from) return;
    setState({ status: "loading" });
    setStay({ ...draft });
    setAsking(false);
    setOpen(true);
    const q = new URLSearchParams(window.location.search);
    q.set("from", draft.from);
    q.set("to", draft.to);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}${window.location.hash}`);
  }

  function toggleSave(ev: EventItem) {
    setSaved((now) => {
      const next = { ...now };
      if (next[ev.id]) delete next[ev.id];
      else next[ev.id] = ev;
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: saved for this visit only */
      }
      return next;
    });
  }

  const km = (n: number) => (n < 1 ? `${Math.max(100, Math.round(n * 10) * 100)} m` : `${number(lang, n, { max: n < 10 ? 1 : 0 })} km`);
  const when = (ev: EventItem) => {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : null;
    const multiDay = end && fmt.dayKey.format(end) !== fmt.dayKey.format(start);
    if (multiDay) return `${fmt.day.format(start)} – ${fill(lang, t.until, { date: fmt.short.format(end) })}`;
    return `${fmt.day.format(start)} · ${ev.all_day ? t.allDay : fmt.time.format(start)}`;
  };
  const price = (ev: EventItem): { free: boolean; text: string } | null => {
    const p = ev.price;
    if (p.free) return { free: true, text: t.free };
    if (p.min !== null && p.min > 0) {
      const amount = isCurrency(p.currency) ? formatPrice(lang, p.min, p.currency) : `${number(lang, p.min)} ${p.currency}`;
      return { free: false, text: fill(lang, t.from, { price: amount }) };
    }
    if (p.text) return { free: false, text: `${t.paid} · ${p.text}` };
    if (p.free === false) return { free: false, text: t.paid };
    return null;
  };

  const stayText = stay ? `${fmt.stayDay.format(new Date(`${stay.from}T12:00Z`))} – ${fmt.stayDay.format(new Date(`${stay.to}T12:00Z`))}` : "";
  const dateForm = (
    <form className={styles.eventDates} onSubmit={showStay}>
      <label>
        <span>{t.arrival}</span>
        <input type="date" required min={today} value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value, to: d.to && d.to < e.target.value ? "" : d.to }))} />
      </label>
      <label>
        <span>{t.departure}</span>
        <input type="date" required min={draft.from || today} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
      </label>
      <button type="submit" className={styles.eventPrimary} disabled={!draft.from || !draft.to}>
        {t.show}
      </button>
    </form>
  );

  // No dates yet: ask for them before suggesting anything.
  if (!stay || asking) {
    return (
      <div className={styles.eventsCard}>
        <h3>{t.title}</h3>
        <p>{t.askDates}</p>
        {dateForm}
      </div>
    );
  }
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className={styles.eventsCard} aria-busy="true">
        <p className={styles.nearbyNote}>{t.loading}</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={styles.eventsCard}>
        <p className={styles.nearbyNote}>{t.error}</p>
      </div>
    );
  }

  const events = state.answer.events;
  const changeDates = (
    <button type="button" className={styles.eventLink} onClick={() => setAsking(true)}>
      {t.changeDates}
    </button>
  );
  if (!events.length) {
    return (
      <div className={styles.eventsCard} data-empty="true">
        <p className={styles.nearbyNote}>
          {t.none} <span className={styles.eventStay}>{stayText}</span> {changeDates}
        </p>
      </div>
    );
  }

  const present = (Object.keys(t.interests) as Interest[]).filter((k) => events.some((e) => e.interests.includes(k)));
  const savedCount = events.filter((e) => saved[e.id]).length;
  const shown = events.filter((e) => (interest === "all" ? true : interest === "saved" ? saved[e.id] : e.interests.includes(interest)));

  return (
    <div className={styles.eventsCard} data-open={open}>
      <div className={styles.eventsHead}>
        <div>
          <h3>{t.title}</h3>
          <p>
            {open ? null : `${t.invite} `}
            <span className={styles.eventStay}>{stayText}</span> {changeDates}
          </p>
        </div>
        <button type="button" className={open ? styles.eventSecondary : styles.eventPrimary} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t.hide : `${t.explore} (${events.length})`}
        </button>
      </div>
      {open ? (
        <>
          <div className={styles.eventFilters} role="group" aria-label={t.title}>
            {(["all", ...present] as const).map((k) => (
              <button key={k} type="button" aria-pressed={interest === k} onClick={() => setInterest(k)}>
                {k === "all" ? t.all : t.interests[k]}
              </button>
            ))}
            {savedCount ? (
              <button type="button" aria-pressed={interest === "saved"} onClick={() => setInterest("saved")}>
                {fill(lang, t.savedOnly, { n: String(savedCount) })}
              </button>
            ) : null}
          </div>
          <ul className={styles.eventList}>
            {shown.map((ev) => {
              const cost = price(ev);
              const isSaved = Boolean(saved[ev.id]);
              return (
                <li key={ev.id} className={styles.eventItem}>
                  <div className={styles.eventMain}>
                    <p className={styles.eventWhen}>{when(ev)}</p>
                    <h4>{ev.name}</h4>
                    <p className={styles.eventWhere}>
                      {[ev.venue, fill(lang, t.away, { distance: km(ev.km) })].filter(Boolean).join(" · ")}
                    </p>
                    {ev.description ? <p className={styles.eventText}>{ev.description}</p> : null}
                    <div className={styles.eventFoot}>
                      {cost ? (
                        <span className={styles.eventPrice} data-free={cost.free}>
                          {cost.text}
                        </span>
                      ) : null}
                      <a className={styles.eventLink} href={ev.url} target="_blank" rel={ev.sponsored ? "sponsored noopener" : "noopener"}>
                        {t.tickets}
                        <External className={styles.icon16} />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.eventSave}
                    aria-pressed={isSaved}
                    aria-label={`${isSaved ? t.saved : t.save}: ${ev.name}`}
                    onClick={() => toggleSave(ev)}
                  >
                    <Heart className={styles.icon22} filled={isSaved} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={styles.nearbySource}>
            {fill(lang, t.source, { sources: state.answer.sources.join(", ") })}
            {state.answer.affiliate ? ` ${t.affiliate}` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
