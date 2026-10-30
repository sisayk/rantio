"use client";

/* eslint-disable @next/next/no-img-element -- the owner's own uploads, served by Django */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Messages } from "@/i18n";
import { countryName, fill, number, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { formatPrice, isCurrency } from "@/lib/currency";
import { type ListingStatus, type ListingSummary, ownerApi, SignedOut } from "@/lib/ownerApi";
import HostingHeader from "./HostingHeader";
import SiteIcon from "./SiteIcon";
import styles from "./owner.module.css";
import { dateFormats } from "./listing/shared";
import { Dialog, useToasts } from "./listing/ui";
import s from "./listing/editor.module.css";

type Filter = "all" | "live" | "draft" | "paused" | "archived";
const MATCH: Record<Filter, (st: ListingStatus) => boolean> = {
  all: (st) => st !== "archived",
  live: (st) => st === "live",
  draft: (st) => st === "intake" || st === "listing",
  paused: (st) => st === "paused",
  archived: (st) => st === "archived",
};

/** Hosting → My listings: every property, what it needs, and what to do with it. */
export default function OwnerListings({
  lang,
  t,
  l,
  countries,
  languageButton,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  l: Messages["listings"];
  countries?: Record<string, string>;
  languageButton: React.ReactNode;
}) {
  const [cottages, setCottages] = useState<ListingSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [owner, setOwner] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [delist, setDelist] = useState<ListingSummary | null>(null);
  const toasts = useToasts();
  const fmt = useMemo(() => dateFormats(lang), [lang]);

  const signedOut = useCallback(() => window.location.replace(paths.hostingLogin(lang)), [lang]);

  const load = useCallback(async () => {
    try {
      setCottages((await ownerApi.listings()).cottages);
      setFailed(false);
    } catch (err) {
      if (err instanceof SignedOut) signedOut();
      else setFailed(true);
    }
  }, [signedOut]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ownerApi.me().then((me) => setOwner(me.name), () => undefined);
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setWorking(true);
    try {
      const d = await ownerApi.createListing(name.trim());
      window.location.assign(`${paths.hostingListing(lang, d.id)}#basics`);
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      toasts.push("error", l.networkError);
      setWorking(false);
    }
  }

  async function duplicate(c: ListingSummary) {
    setWorking(true);
    try {
      const d = await ownerApi.duplicateListing(c.id);
      toasts.push("ok", fill(lang, l.duplicated, { name: d.name }));
      await load();
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      toasts.push("error", l.networkError);
    } finally {
      setWorking(false);
    }
  }

  async function pause() {
    if (!delist) return;
    setWorking(true);
    try {
      await ownerApi.setListingStatus(delist.id, "pause");
      toasts.push("ok", l.status.paused);
      setDelist(null);
      await load();
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      toasts.push("error", l.status.notAllowed);
    } finally {
      setWorking(false);
    }
  }

  const shown = (cottages ?? []).filter((c) => MATCH[filter](c.status));
  const count = (f: Filter) => (cottages ?? []).filter((c) => MATCH[f](c.status)).length;

  return (
    <div className={styles.page}>
      <HostingHeader lang={lang} t={t} languageButton={languageButton} active="listings" ownerName={owner} />
      <main className={styles.main}>
        <div className={styles.intro}>
          <div>
            <h1>{l.title}</h1>
            <p>{l.lead}</p>
          </div>
          <button type="button" className={styles.primary} onClick={() => setAdding(true)}>
            + {l.add}
          </button>
        </div>

        {failed ? (
          <div className={styles.errorBox} role="alert">
            <p>{t.error}</p>
            <button type="button" className={styles.primary} onClick={() => void load()}>
              {t.retry}
            </button>
          </div>
        ) : !cottages ? (
          <div className={styles.skeleton} aria-busy="true" aria-label={t.loading}>
            <span />
            <span />
          </div>
        ) : cottages.length === 0 ? (
          <div className={s.empty}>
            <p>{l.empty}</p>
            <button type="button" className={styles.primary} onClick={() => setAdding(true)}>
              + {l.add}
            </button>
          </div>
        ) : (
          <>
            <div className={s.toolbar}>
              <div className={s.chips} role="group" aria-label={l.title}>
                {(Object.keys(MATCH) as Filter[]).map((f) => (
                  <button key={f} type="button" className={s.chip} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {l.filters[f]} <span aria-hidden="true">{number(lang, count(f))}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className={s.cards}>
              {shown.map((c) => {
                const edit = paths.hostingListing(lang, c.id);
                const price = formatPrice(lang, Number(c.price_per_night), isCurrency(c.currency) ? c.currency : "EUR");
                const sites = c.channels.filter((ch) => ch.state !== "not_connected");
                return (
                  <li key={c.id} className={s.card}>
                    <a className={s.cardPhoto} href={edit} tabIndex={-1} aria-hidden="true">
                      {c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <span>{l.noPhotos}</span>}
                    </a>
                    <div className={s.cardBody}>
                      <div className={s.cardHead}>
                        <div>
                          <h2>
                            <a href={edit}>{c.name}</a>
                          </h2>
                          <p className={s.cardMeta}>
                            {l.types[c.property_type]} · {[c.municipality, countries?.[c.country] ?? countryName(lang, c.country)].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <span className={s.badge} data-status={c.status}>
                          {l.statusNames[c.status]}
                        </span>
                      </div>
                      <p className={s.cardFacts}>
                        <span>{plural(lang, l.units.guests, c.max_guests)}</span>
                        <span>{plural(lang, l.units.bedrooms, c.bedrooms)}</span>
                        <span>{plural(lang, l.units.beds, c.beds)}</span>
                        <span>{plural(lang, l.units.bathrooms, c.bathrooms)}</span>
                        <span>{Number(c.price_per_night) > 0 ? fill(lang, l.perNight, { price }) : null}</span>
                      </p>
                      {sites.length ? (
                        <ul className={s.channelList}>
                          {sites.map((ch) => (
                            <li key={ch.channel} title={l.calendar.states[ch.state]}>
                              <span className={s.dot} data-state={ch.state} />
                              <SiteIcon channel={ch.channel} label={ch.channel} ownBooking={t.ownBooking} />
                              {ch.state !== "connected" && ch.state !== "email" ? <span className={s.muted}>({l.calendar.states[ch.state]})</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className={s.cardMeta}>
                        {c.upcoming_count
                          ? [
                              plural(lang, l.units.stays, c.upcoming_count),
                              c.next_check_in ? fill(lang, l.nextStay, { date: fmt.day(c.next_check_in) }) : null,
                              fill(lang, l.occupancy, { pct: number(lang, Math.round(c.occupancy_30 * 100)) }),
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : l.noStays}
                        <br />
                        {fill(lang, l.updated, { date: fmt.full(c.updated_at) })}
                      </p>
                      <div className={s.progress}>
                        <span>{fill(lang, l.complete, { pct: number(lang, c.completeness) })}</span>
                        <span className={s.progressBar}>
                          <span style={{ width: `${c.completeness}%` }} />
                        </span>
                      </div>
                      <div className={s.cardActions}>
                        <a className={styles.primary} href={edit}>
                          {l.actions.view}
                        </a>
                        <a className={s.button} href={`${edit}#basics`}>
                          {l.actions.edit}
                        </a>
                        <a className={s.button} href={paths.hostingListingPreview(lang, c.id)} target="_blank" rel="noopener">
                          {l.actions.preview}
                        </a>
                        <button type="button" className={s.button} disabled={working} onClick={() => void duplicate(c)}>
                          {l.actions.duplicate}
                        </button>
                        {c.status === "live" || c.status === "listing" ? (
                          <button type="button" className={s.button} onClick={() => setDelist(c)}>
                            {l.actions.delist}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      <Dialog open={adding} title={l.addTitle} onClose={() => setAdding(false)}>
        <form
          className={s.dialogBody}
          style={{ padding: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className={s.field}>
            <span>{l.addName}</span>
            <input className={s.input} required maxLength={120} placeholder={l.addPlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className={s.dialogActions}>
            <button type="button" className={s.button} onClick={() => setAdding(false)}>
              {l.cancel}
            </button>
            <button type="submit" className={styles.primary} disabled={working || !name.trim()}>
              {l.addCreate}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(delist)} title={l.status.pauseTitle} onClose={() => setDelist(null)}>
        <p>{l.status.pauseBody}</p>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setDelist(null)}>
            {l.cancel}
          </button>
          <button type="button" className={styles.primary} disabled={working} onClick={() => void pause()}>
            {l.status.pause}
          </button>
        </div>
      </Dialog>
      {toasts.view}
    </div>
  );
}
