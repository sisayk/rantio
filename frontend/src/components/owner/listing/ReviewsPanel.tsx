"use client";

import { useEffect, useState } from "react";
import { fill, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { REVIEWS, type ReviewsText } from "@/i18n/messages/reviews";
import { type ExternalRating, ownerApi, type OwnerReviews, type ReviewRow, SignedOut } from "@/lib/ownerApi";
import { previewRatings } from "@/lib/ratingsPreview";
import RatingsSection, { ReviewItem, score, Stars } from "../../Ratings";
import r from "../../ratings.module.css";
import SiteIcon from "../SiteIcon";
import o from "../owner.module.css";
import s from "./editor.module.css";

/** The error text for a refused score, from the server's answer. */
export function ratingError(t: ReviewsText, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const first = (k: string) => (Array.isArray(b[k]) ? String((b[k] as unknown[])[0]) : "");
  const code = first("url") || first("score");
  return code in t.owner.errors ? t.owner.errors[code as keyof ReviewsText["owner"]["errors"]] : t.owner.errors.other;
}

/** Listing editor → Reviews and ratings: guests' reviews with the owner's replies, and scores from other sites. */
export default function ReviewsPanel({ lang, cottage, ownBooking, onSignedOut }: {
  lang: Lang;
  cottage: number;
  ownBooking: string;
  onSignedOut: () => void;
}) {
  const t = REVIEWS[lang];
  const [data, setData] = useState<OwnerReviews | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    ownerApi
      .reviews(cottage)
      .then(setData)
      .catch((e) => (e instanceof SignedOut ? onSignedOut() : setFailed(true)));
  }, [cottage, onSignedOut]);

  if (!data) return <p className={s.muted}>{failed ? t.owner.errors.other : "…"}</p>;

  const setReview = (row: ReviewRow) => setData((d) => (d ? { ...d, reviews: d.reviews.map((x) => (x.id === row.id ? row : x)) } : d));
  const setExternal = (list: ExternalRating[]) => setData((d) => (d ? { ...d, external: list } : d));

  return (
    <>
      <p className={s.panelLead}>{t.owner.lead}</p>
      <div className={s.group}>
        <h3>
          {data.count && data.average !== null ? (
            <>
              <Stars value={data.average} size={16} /> {score(lang, data.average)} · {plural(lang, t.count, data.count)}
            </>
          ) : (
            t.title
          )}
        </h3>
        {data.reviews.length === 0 ? <p className={s.muted}>{t.owner.none}</p> : null}
        <ul className={r.reviews} style={{ gridTemplateColumns: "1fr" }}>
          {data.reviews.map((row) => (
            <OwnerReview key={row.id} lang={lang} row={row} onChange={setReview} onSignedOut={onSignedOut} />
          ))}
        </ul>
      </div>
      <Elsewhere lang={lang} cottage={cottage} data={data} ownBooking={ownBooking} onChange={setExternal} onSignedOut={onSignedOut} />
      {data.count === 0 ? (
        <div className={s.group}>
          <h3>
            {t.owner.previewTitle} <span className={s.badge}>{t.owner.example}</span>
          </h3>
          <p className={s.hint}>{t.owner.previewLead}</p>
          <div className={r.preview}>
            <RatingsSection lang={lang} ratings={previewRatings(t, data.external)} host={t.owner.yourReply} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function OwnerReview({ lang, row, onChange, onSignedOut }: {
  lang: Lang;
  row: ReviewRow;
  onChange: (row: ReviewRow) => void;
  onSignedOut: () => void;
}) {
  const t = REVIEWS[lang];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(row.reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      onChange(await ownerApi.replyToReview(row.id, text.trim()));
      setEditing(false);
    } catch (e) {
      if (e instanceof SignedOut) onSignedOut();
      else setError(t.owner.errors.other);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, paddingBottom: 16, borderBottom: "1px solid #e3e7e5" }}>
      <ReviewItem lang={lang} r={{ ...row, reply: editing ? "" : row.reply }} host={t.owner.yourReply} />
      {row.hidden ? <span className={s.badge}>{t.owner.hidden}</span> : null}
      {editing ? (
        <>
          <textarea className={s.input} rows={3} maxLength={1000} value={text} placeholder={t.owner.replyPlaceholder} onChange={(e) => setText(e.target.value)} />
          <div className={s.row}>
            <button type="button" className={o.primary} disabled={busy} onClick={() => void save()}>
              {t.owner.save}
            </button>
            <button type="button" className={s.ghost} onClick={() => setEditing(false)}>
              {t.owner.cancel}
            </button>
          </div>
          {error ? <p className={s.error}>{error}</p> : null}
        </>
      ) : (
        <div>
          <button type="button" className={s.button} onClick={() => setEditing(true)}>
            {row.reply ? t.owner.editReply : t.owner.reply}
          </button>
        </div>
      )}
    </div>
  );
}

function Elsewhere({ lang, cottage, data, ownBooking, onChange, onSignedOut }: {
  lang: Lang;
  cottage: number;
  data: OwnerReviews;
  ownBooking: string;
  onChange: (list: ExternalRating[]) => void;
  onSignedOut: () => void;
}) {
  const t = REVIEWS[lang];
  const [url, setUrl] = useState("");
  const [value, setValue] = useState("");
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const row = await ownerApi.addRating(cottage, url.trim(), value.replace(",", "."), Number(count));
      onChange([...data.external.filter((x) => x.site !== row.site), row].sort((a, b) => a.site.localeCompare(b.site)));
      setUrl("");
      setValue("");
      setCount("");
    } catch (err) {
      if (err instanceof SignedOut) onSignedOut();
      else setError(ratingError(t, (err as { body?: unknown }).body));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await ownerApi.removeRating(id);
      onChange(data.external.filter((x) => x.id !== id));
    } catch (err) {
      if (err instanceof SignedOut) onSignedOut();
    }
  }

  return (
    <div className={s.group}>
      <h3>{t.elsewhere}</h3>
      <p className={s.hint}>{t.owner.elsewhereLead}</p>
      {data.external.length ? (
        <ul className={r.external}>
          {data.external.map((e) => (
            <li key={e.id}>
              <SiteIcon channel={e.site} label={e.name} ownBooking={ownBooking} />
              <span className={r.extScore}>
                {fill(lang, t.outOf, { score: score(lang, e.score), scale: e.scale })} · {plural(lang, t.count, e.count)}
              </span>
              <button type="button" className={s.ghost} style={{ marginLeft: "auto" }} onClick={() => void remove(e.id)}>
                {t.owner.remove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={add} style={{ display: "grid", gap: 10, marginTop: 8 }}>
        <label className={s.field}>
          <span>{t.owner.url}</span>
          <input className={s.input} type="url" inputMode="url" placeholder="https://www.airbnb.fi/rooms/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <div className={s.row}>
          <label className={s.field} style={{ flex: 1 }}>
            <span>{t.owner.score}</span>
            <input className={s.input} inputMode="decimal" placeholder="4.9" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className={s.field} style={{ flex: 1 }}>
            <span>{t.owner.count}</span>
            <input className={s.input} inputMode="numeric" placeholder="87" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        {error ? <p className={s.error}>{error}</p> : null}
        <div>
          <button type="submit" className={o.primary} disabled={busy || !url.trim() || !value.trim() || !count}>
            {t.owner.add}
          </button>
        </div>
      </form>
    </div>
  );
}
