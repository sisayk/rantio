"use client";

import { useEffect, useState } from "react";
import { fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { REVIEWS } from "@/i18n/messages/reviews";
import { paths } from "@/i18n/paths";
import { guestApi, type ReviewPage } from "@/lib/ownerApi";
import { ReviewItem } from "./Ratings";
import { Wordmark } from "./guest/icons";
import chat from "./chat.module.css";
import styles from "./ratings.module.css";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; page: ReviewPage };
const PARTS = ["cleanliness", "location", "value"] as const;

function StarPicker({ value, onChange, label, small, starWord }: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  small?: boolean;
  starWord: (n: number) => string;
}) {
  return (
    <fieldset className={`${styles.picker} ${small ? styles.small : ""}`} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? styles.on : ""}
          aria-pressed={n === value}
          aria-label={starWord(n)}
          onClick={() => onChange(n === value && small ? 0 : n)}
        >
          ★
        </button>
      ))}
    </fieldset>
  );
}

/** A guest rates a stay booked through Rantio, opened with their conversation's private link. */
export default function ReviewForm({ lang, token, loading, languageButton }: {
  lang: Lang;
  token: string;
  loading: string;
  languageButton: React.ReactNode;
}) {
  const t = REVIEWS[lang];
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [rating, setRating] = useState(0);
  const [parts, setParts] = useState<Record<(typeof PARTS)[number], number>>({ cleanliness: 0, location: 0, value: 0 });
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    guestApi
      .reviewPage(token)
      .then((page) => setLoad({ state: "ready", page }))
      .catch((e: { status?: number }) => setLoad({ state: e.status === 404 ? "missing" : "error" }));
  }, [token]);

  const header = (
    <header className={chat.guestTop}>
      <a className={chat.brand} href={paths.home(lang)}>
        <Wordmark />
      </a>
      {languageButton}
    </header>
  );

  if (load.state !== "ready") {
    return (
      <div className={chat.guestPage}>
        {header}
        <main className={styles.formPage}>
          <p aria-busy={load.state === "loading"}>{load.state === "loading" ? loading : load.state === "missing" ? t.page.missing : t.page.error}</p>
        </main>
      </div>
    );
  }

  const p = load.page;
  const day = new Intl.DateTimeFormat(LANG_INFO[lang].intl, { day: "numeric", month: "short", year: "numeric" });
  const dates = p.check_in && p.check_out ? `${day.format(new Date(`${p.check_in}T12:00:00`))} – ${day.format(new Date(`${p.check_out}T12:00:00`))}` : "";
  const starWord = (n: number) => plural(lang, t.page.star, n);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError(t.page.pick);
    setSending(true);
    setError("");
    try {
      const page = await guestApi.sendReview(token, {
        rating,
        cleanliness: parts.cleanliness || null,
        location: parts.location || null,
        value: parts.value || null,
        comment: comment.trim(),
      });
      setLoad({ state: "ready", page });
      setSent(true);
    } catch {
      setError(t.page.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={chat.guestPage}>
      {header}
      <main className={styles.formPage}>
        <h1>{p.review ? (sent ? t.page.thanks : t.page.yours) : t.page.title}</h1>
        <p>{[p.cottage, dates].filter(Boolean).join(" · ")}</p>

        {p.review ? (
          <div className={styles.card} role={sent ? "status" : undefined}>
            {sent ? <p style={{ margin: 0 }}>{t.page.thanksLead}</p> : null}
            <ul className={styles.reviews} style={{ marginTop: 0 }}>
              <ReviewItem lang={lang} r={p.review} host={p.host} />
            </ul>
          </div>
        ) : !p.can_review ? (
          <div className={styles.card}>
            <p style={{ margin: 0 }}>{p.reason === "too_late" ? t.page.tooLate : t.page.notStayed}</p>
          </div>
        ) : (
          <form className={styles.card} onSubmit={send} noValidate>
            <div className={styles.field}>
              <h2>{t.page.overall}</h2>
              <StarPicker value={rating} onChange={setRating} label={t.page.overall} starWord={starWord} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {PARTS.map((k) => (
                <div key={k} className={styles.row}>
                  <span>
                    {t.categories[k]}
                    <small style={{ color: "#5d6a6e" }}>{t.page.optional}</small>
                  </span>
                  <StarPicker small value={parts[k]} onChange={(n) => setParts({ ...parts, [k]: n })} label={t.categories[k]} starWord={starWord} />
                </div>
              ))}
            </div>
            <label className={styles.field}>
              <span>{t.page.comment}</span>
              <textarea rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
              <small>{fill(lang, t.page.commentHint, { host: p.host || "Rantio" })}</small>
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className={styles.send} disabled={sending}>
              {sending ? t.page.sending : t.page.send}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
