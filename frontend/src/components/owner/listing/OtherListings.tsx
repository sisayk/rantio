"use client";

import { useMemo, useState } from "react";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { linkError, OTHER_LISTINGS, type OtherListing } from "@/i18n/messages/otherListings";
import { ownerApi, SignedOut } from "@/lib/ownerApi";
import SiteIcon from "../SiteIcon";
import o from "../owner.module.css";
import { dateFormats } from "./shared";
import s from "./editor.module.css";

/** The owner's listings on other sites: add a link (and its calendar), see if the calendar reads, remove. */
export default function OtherListings({
  lang,
  cottage,
  initial,
  forwardingAddress,
  ownBooking,
  onSignedOut,
}: {
  lang: Lang;
  cottage: number;
  initial: OtherListing[];
  forwardingAddress: string;
  ownBooking: string;
  onSignedOut: () => void;
}) {
  const t = OTHER_LISTINGS[lang];
  const fmt = useMemo(() => dateFormats(lang), [lang]);
  const [links, setLinks] = useState(initial);
  const [url, setUrl] = useState("");
  const [cal, setCal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editCal, setEditCal] = useState("");
  const [rowError, setRowError] = useState("");

  async function run<T>(job: () => Promise<T>, onError: (msg: string) => void): Promise<T | null> {
    setBusy(true);
    try {
      return await job();
    } catch (e) {
      if (e instanceof SignedOut) onSignedOut();
      else onError(linkError(t, (e as { body?: unknown }).body));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError("");
    const row = await run(() => ownerApi.addOtherListing(cottage, url.trim(), cal.trim()), setError);
    if (row) {
      setLinks((now) => [...now, row]);
      setUrl("");
      setCal("");
    }
  }

  async function saveCalendar(id: number, value: string) {
    setRowError("");
    const row = await run(() => ownerApi.setOtherListingCalendar(id, value.trim()), setRowError);
    if (row) {
      setLinks((now) => now.map((k) => (k.id === id ? row : k)));
      setEditing(null);
    }
  }

  async function remove(id: number) {
    const done = await run(() => ownerApi.removeOtherListing(id).then(() => true), setRowError);
    if (done) setLinks((now) => now.filter((k) => k.id !== id));
  }

  return (
    <div className={s.group}>
      <h3>{t.title}</h3>
      <p className={s.hint}>{t.lead}</p>
      {links.length ? (
        <ul className={s.siteRows}>
          {links.map((k) => (
            <li key={k.id}>
              <span className={s.siteName}>
                <SiteIcon channel={k.site} label={k.name} ownBooking={ownBooking} />
              </span>
              {k.site === "nettimokki" ? (
                <span />
              ) : (
                <span className={s.badge}>
                  <span className={s.dot} data-state={k.calendar_state} />
                  {t.states[k.calendar_state]}
                </span>
              )}
              <span className={`${s.muted} ${s.small}`} style={{ gridColumn: "1 / -1", overflowWrap: "anywhere" }}>
                <a href={k.url} target="_blank" rel="noopener noreferrer">
                  {t.open}
                </a>
                {k.site === "nettimokki"
                  ? ` · ${fill(lang, t.nettimokki, { address: forwardingAddress })}`
                  : k.last_synced_at
                    ? ` · ${fill(lang, t.lastRead, { time: fmt.stamp(k.last_synced_at) })}`
                    : ""}
                {k.calendar_error ? ` · ${k.calendar_error}` : ""}
              </span>
              {editing === k.id ? (
                <form
                  style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveCalendar(k.id, editCal);
                  }}
                >
                  <label className={s.field}>
                    <span>{t.calendar}</span>
                    <input className={s.input} type="url" inputMode="url" placeholder="https://….ics" value={editCal} onChange={(e) => setEditCal(e.target.value)} />
                    <span className={s.hint}>{t.calendarHint}</span>
                  </label>
                  {rowError ? <span className={s.error}>{rowError}</span> : null}
                  <div className={s.row}>
                    <button type="submit" className={o.primary} disabled={busy}>
                      {t.save}
                    </button>
                    <button type="button" className={s.ghost} onClick={() => setEditing(null)}>
                      {t.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <span style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {k.site !== "nettimokki" ? (
                    <button
                      type="button"
                      className={s.ghost}
                      onClick={() => {
                        setEditing(k.id);
                        setEditCal(k.calendar_url);
                        setRowError("");
                      }}
                    >
                      {k.calendar_url ? t.calendar : t.addCalendar}
                    </button>
                  ) : null}
                  <button type="button" className={s.ghost} disabled={busy} onClick={() => void remove(k.id)}>
                    {t.remove}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>{t.none}</p>
      )}
      <form onSubmit={add} style={{ display: "grid", gap: 12 }}>
        <label className={s.field}>
          <span>{t.url}</span>
          <input
            className={s.input}
            type="url"
            inputMode="url"
            required
            maxLength={500}
            placeholder="https://www.lomarengas.fi/…"
            value={url}
            aria-invalid={Boolean(error)}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className={s.field}>
          <span>{t.calendar}</span>
          <input className={s.input} type="url" inputMode="url" maxLength={1000} placeholder="https://….ics" value={cal} onChange={(e) => setCal(e.target.value)} />
          <span className={s.hint}>{t.calendarHint}</span>
        </label>
        {error ? <span className={s.error}>{error}</span> : null}
        <div>
          <button type="submit" className={s.button} disabled={busy || !url.trim()}>
            {busy ? t.adding : t.add}
          </button>
        </div>
      </form>
    </div>
  );
}
