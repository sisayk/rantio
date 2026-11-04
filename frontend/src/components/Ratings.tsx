/* eslint-disable @next/next/no-img-element -- small favicons of the booking sites */
"use client";

import { useState } from "react";
import { fill, number, plural } from "@/i18n/format";
import { type Lang, LANG_INFO } from "@/i18n/locales";
import { REVIEWS } from "@/i18n/messages/reviews";
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import type { Ratings as RatingsData, ReviewRow } from "@/lib/ownerApi";
import styles from "./ratings.module.css";

const FEW = 4;

export const score = (lang: Lang, n: number) => number(lang, n, { min: 1, max: 1 });

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} style={{ fontSize: size }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? styles.on : styles.off}>
          ★
        </span>
      ))}
    </span>
  );
}

/** "★ 4.8 · 12 reviews", or "New on Rantio" before the first review. */
export function RatingBadge({ lang, ratings }: { lang: Lang; ratings: RatingsData }) {
  const t = REVIEWS[lang];
  if (!ratings.count || ratings.average === null) return <span className={styles.newBadge}>{t.newOnRantio}</span>;
  return (
    <a className={styles.badge} href="#ratings">
      <span className={styles.star}>★</span> {score(lang, ratings.average)} · {plural(lang, t.count, ratings.count)}
    </a>
  );
}

function SiteIcon({ site, name }: { site: string; name: string }) {
  const known = site in CHANNELS;
  return (
    <span className={styles.siteIcon} aria-hidden="true">
      {known ? <img src={channelIcon(site as ChannelId)} alt="" width={18} height={18} loading="lazy" referrerPolicy="no-referrer" /> : name.charAt(0)}
    </span>
  );
}

function month(lang: Lang, ym: string) {
  try {
    return new Intl.DateTimeFormat(LANG_INFO[lang].intl, { month: "long", year: "numeric" }).format(new Date(`${ym}-15T12:00:00`));
  } catch {
    return ym;
  }
}

export function ReviewItem({ lang, r, host }: { lang: Lang; r: ReviewRow; host: string }) {
  const t = REVIEWS[lang];
  return (
    <li className={styles.review}>
      <div className={styles.reviewHead}>
        <span className={styles.avatar} aria-hidden="true">
          {r.name.charAt(0).toUpperCase() || "?"}
        </span>
        <div>
          <strong>{r.name}</strong>
          <small>{fill(lang, t.stayed, { month: month(lang, r.stayed) })}</small>
        </div>
      </div>
      <p className={styles.reviewStars} aria-label={plural(lang, t.page.star, r.rating)}>
        <Stars value={r.rating} />
      </p>
      {r.comment ? <p className={styles.comment} lang={r.language}>{r.comment}</p> : null}
      {r.reply ? (
        <div className={styles.reply}>
          <strong>{fill(lang, t.reply, { host: host || "Rantio" })}</strong>
          <p>{r.reply}</p>
        </div>
      ) : null}
    </li>
  );
}

/** The cottage's ratings: the average and its parts, the newest reviews, and scores on other sites. */
export default function RatingsSection({ lang, ratings, host }: { lang: Lang; ratings: RatingsData; host: string }) {
  const t = REVIEWS[lang];
  const [all, setAll] = useState(false);
  const shown = all ? ratings.reviews : ratings.reviews.slice(0, FEW);
  return (
    <section id="ratings" className={styles.section} aria-labelledby="ratings-title">
      <h2 id="ratings-title">
        {ratings.count && ratings.average !== null ? (
          <>
            <span className={styles.star}>★</span> {score(lang, ratings.average)} · {plural(lang, t.count, ratings.count)}
          </>
        ) : (
          t.title
        )}
      </h2>

      {ratings.count && ratings.categories ? (
        <dl className={styles.categories}>
          {(["cleanliness", "location", "value"] as const).map((k) =>
            ratings.categories?.[k] != null ? (
              <div key={k}>
                <dt>{t.categories[k]}</dt>
                <dd>
                  <span className={styles.bar}>
                    <span style={{ width: `${((ratings.categories[k] ?? 0) / 5) * 100}%` }} />
                  </span>
                  {score(lang, ratings.categories[k] ?? 0)}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className={styles.newLine}>
          <span className={styles.newBadge}>{t.newOnRantio}</span> {t.newLead}
        </p>
      )}

      {shown.length ? (
        <ul className={styles.reviews}>
          {shown.map((r) => (
            <ReviewItem key={r.id} lang={lang} r={r} host={host} />
          ))}
        </ul>
      ) : null}
      {ratings.reviews.length > FEW ? (
        <button type="button" className={styles.more} onClick={() => setAll(!all)}>
          {all ? t.showFewer : t.showAll}
        </button>
      ) : null}

      {ratings.external.length ? (
        <>
          <h3>{t.elsewhere}</h3>
          <ul className={styles.external}>
            {ratings.external.map((e) => (
              <li key={e.id}>
                <SiteIcon site={e.site} name={e.name} />
                <span className={styles.extName}>{e.name}</span>
                <span className={styles.extScore}>
                  {fill(lang, t.outOf, { score: score(lang, e.score), scale: e.scale })} · {plural(lang, t.count, e.count)}
                </span>
                <a href={e.url} target="_blank" rel="noopener noreferrer nofollow">
                  {fill(lang, t.seeOn, { site: e.name })}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className={styles.small}>{t.verified}</p>
    </section>
  );
}
