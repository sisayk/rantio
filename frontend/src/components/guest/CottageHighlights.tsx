/* eslint-disable @next/next/no-img-element -- the host's own photo, from Rantio's media */
"use client";

// The top of a cottage's page, as in Airbnb's: rating · Guest favourite · reviews, then who hosts.
// Only real data (lib/cottageAbout.ts); before the first review it says "New on Rantio".
import { fill, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { HIGHLIGHTS } from "@/i18n/messages/highlights";
import { REVIEWS } from "@/i18n/messages/reviews";
import { useCottageAbout } from "@/lib/cottageAbout";
import RatingsSection, { score, Stars } from "../Ratings";
import styles from "./highlights.module.css";

/** A laurel branch (the left one; mirrored for the right): a curved stem with leaves on both sides. */
function Laurel({ flip = false }: { flip?: boolean }) {
  // [x, y, angle]: outer leaves point up and out, inner ones up and in.
  const outer = [[8, 36, -55], [6, 28, -40], [5.5, 20, -25], [6.5, 12, -10], [9.5, 5, 10]];
  const inner = [[16.5, 31, 35], [14.5, 23, 25], [13.5, 15, 15]];
  return (
    <svg viewBox="0 0 26 44" className={styles.laurel} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
      <path d="M19 43C10 35 8 22 12 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {[...outer, ...inner].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.4" ry="4.6" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" />
      ))}
    </svg>
  );
}

/** "26" over "reviews": the language's own words for the count, without the number. */
const countWord = (lang: Lang, n: number) => plural(lang, REVIEWS[lang].count, n).replace(/[\d\s .,]+/, " ").trim();

export function CottageHighlights({ lang, slug }: { lang: Lang; slug: string }) {
  const { ratings, guestFavourite, host } = useCottageAbout(slug);
  const t = HIGHLIGHTS[lang];
  const r = REVIEWS[lang];
  const rated = ratings.count > 0 && ratings.average !== null;

  return (
    <div className={styles.wrap}>
      {rated ? (
        <a className={`${styles.stats} ${guestFavourite ? styles.three : ""}`} href="#ratings">
          <span className={styles.stat}>
            <strong>{score(lang, ratings.average ?? 0)}</strong>
            <Stars value={ratings.average ?? 0} size={12} />
          </span>
          {guestFavourite ? (
            <span className={styles.favourite} title={t.favouriteLead}>
              <Laurel />
              <strong>{t.guestFavourite}</strong>
              <Laurel flip />
            </span>
          ) : null}
          <span className={styles.stat}>
            <strong>{ratings.count}</strong>
            <span>{countWord(lang, ratings.count)}</span>
          </span>
        </a>
      ) : (
        <a className={styles.newRow} href="#ratings">
          <span className={styles.newStar} aria-hidden="true">★</span>
          <span>
            <strong>{r.newOnRantio}</strong>
            <span>{r.newLead}</span>
          </span>
        </a>
      )}

      {ratings.external.length ? (
        <ul className={styles.elsewhere} aria-label={r.elsewhere}>
          {ratings.external.map((e) => (
            <li key={e.id}>
              <a href={e.url} target="_blank" rel="noopener noreferrer">
                <strong>{e.name}</strong> ★ {score(lang, e.score)}
                {e.scale !== 5 ? ` / ${e.scale}` : ""} · {plural(lang, r.count, e.count)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {host ? (
        <div className={styles.host}>
          {host.photo ? (
            <img className={styles.avatar} src={host.photo} alt="" width={48} height={48} />
          ) : (
            <span className={styles.avatar} aria-hidden="true">
              {host.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>
            <strong>{fill(lang, t.hostedBy, { name: host.name })}</strong>
            <span>{fill(lang, t.hostingSince, { year: String(host.since) })}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** "★ 4.9" by the place name under the title, or "New on Rantio"; it goes to the Ratings box. */
export function TitleRating({ lang, slug, className, star }: { lang: Lang; slug: string; className: string; star: React.ReactNode }) {
  const { ratings } = useCottageAbout(slug);
  return (
    <a className={className} href="#ratings">
      {star}
      {ratings.count && ratings.average !== null ? score(lang, ratings.average) : REVIEWS[lang].newOnRantio}
    </a>
  );
}

/** The Ratings box further down the page, with the same real reviews. */
export function LiveRatings({ lang, slug }: { lang: Lang; slug: string }) {
  const { ratings, host } = useCottageAbout(slug);
  return <RatingsSection lang={lang} ratings={ratings} host={host?.name ?? ""} />;
}
