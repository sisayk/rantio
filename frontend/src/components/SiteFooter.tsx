/* eslint-disable @next/next/no-img-element -- example cottage photos from Unsplash's CDN, sized by CSS */
// The footer on every public page. Guest pages get the whole thing: what Rantio stands
// for, the app, the newsletter and the links. The hosts page gets the app (owners use it
// for messages and the calendar) and the links; the legal pages only the links.

import { getMessages } from "@/i18n";
import { countryName } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { getListing, listingName, unsplash } from "@/lib/listings";
import AppBadges from "./AppBadges";
import NewsletterForm from "./NewsletterForm";
import { Wordmark } from "./guest/icons";
import styles from "./SiteFooter.module.css";

type Variant = "guest" | "hosts" | "legal";

// The example cottages in the phone pictures: a Finnish lake, a Norwegian fjord, a Swedish red cottage.
const PHONE_LIST = ["lakeside-villa", "lofoten-rorbu"];
const PHONE_DETAIL = "red-stuga";

const VALUE_ICONS = [
  // water and trees
  <>
    <path d="M7 14 10 6l3 8" />
    <path d="M14 14l3-6 3 6" />
    <path d="M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
  </>,
  // sauna stove with steam
  <>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M9 15h6" />
    <path d="M9 4c-1 1.2 1 2 0 3.5M12 4c-1 1.2 1 2 0 3.5M15 4c-1 1.2 1 2 0 3.5" />
  </>,
  // speech bubble
  <>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4h0.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    <path d="M8 9h8M8 12h5" />
  </>,
  // check in a shield
  <>
    <path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
];

export default function SiteFooter({ lang, variant = "guest", current }: { lang: Lang; variant?: Variant; current?: "privacy" | "terms" }) {
  const m = getMessages(lang);
  const f = m.common.footer;
  const nav = m.guest.nav;
  const explore = [paths.home(lang), paths.experiences(lang), paths.destinations(lang), paths.inspiration(lang)];

  return (
    <footer className={styles.footer}>
      {variant === "guest" ? (
        <section className={styles.values} aria-label={m.common.values.label}>
          {m.common.values.items.map((v, i) => (
            <div key={v.title} className={styles.value}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {VALUE_ICONS[i]}
              </svg>
              <div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {variant !== "legal" ? (
        <div className={`${styles.bands} ${variant === "guest" ? "" : styles.single}`}>
          <section className={styles.app} aria-labelledby="footer-app-title">
            <div className={styles.appText}>
              <h2 id="footer-app-title">{m.common.apps.band}</h2>
              <p>{variant === "hosts" ? m.common.apps.leadHosts : m.common.apps.lead}</p>
              <AppBadges t={m.common.apps} light />
            </div>
            <Phones lang={lang} />
          </section>
          {variant === "guest" ? (
            <section className={styles.news} aria-labelledby="footer-news-title">
              <h2 id="footer-news-title">{m.common.newsletter.title}</h2>
              <p>{m.common.newsletter.lead}</p>
              <NewsletterForm lang={lang} t={m.common.newsletter} />
            </section>
          ) : null}
        </div>
      ) : null}

      <div className={styles.columns}>
        <div className={styles.brand}>
          <a href={paths.home(lang)} className={styles.wordmark}>
            <Wordmark />
          </a>
          <p>{f.tagline}</p>
        </div>
        <nav aria-label={f.explore}>
          <h2>{f.explore}</h2>
          <ul>
            {nav.map((label, i) => (
              <li key={label}>
                <a href={explore[i]}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={f.hosts}>
          <h2>{f.hosts}</h2>
          <ul>
            <li>
              <a href={`${paths.hosts(lang)}#ilmoita`}>{f.listCottage}</a>
            </li>
            <li>
              <a href={`${paths.hosts(lang)}#price-title`}>{f.pricing}</a>
            </li>
            <li>
              <a href={`${paths.hosts(lang)}#monitor`}>{f.monitor}</a>
            </li>
            <li>
              <a href={paths.hostingLogin(lang)}>{f.hostLogin}</a>
            </li>
          </ul>
        </nav>
        <nav aria-label={f.company}>
          <h2>{f.company}</h2>
          <ul>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`}>{f.contact}</a>
              <span className={styles.email}>{CONTACT_EMAIL}</span>
            </li>
            <li>
              <a href={paths.privacy(lang)} aria-current={current === "privacy" ? "page" : undefined}>
                {f.privacy}
              </a>
            </li>
            <li>
              <a href={paths.terms(lang)} aria-current={current === "terms" ? "page" : undefined}>
                {f.terms}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.bottom}>
        <span>© Rantio</span>
        <span>{f.note}</span>
      </div>
    </footer>
  );
}

/** Two phones showing the app: the cottage list and a cottage page. Drawn in HTML, so the
 *  text is in the page's language and stays sharp; the photos are the example cottages'. */
function Phones({ lang }: { lang: Lang }) {
  const m = getMessages(lang);
  const list = PHONE_LIST.map((id) => getListing(id)).filter((l) => l !== undefined);
  const detail = getListing(PHONE_DETAIL);
  const place = (l: { place: string; country: Parameters<typeof countryName>[1] }) =>
    `${l.place.split(", ")[0]}, ${countryName(lang, l.country)}`;
  return (
    <div className={styles.phones} aria-hidden="true">
      <div className={`${styles.phone} ${styles.back}`}>
        <div className={styles.screen}>
          <div className={styles.island} />
          <div className={styles.search}>
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            {m.common.apps.search}
          </div>
          {list.map((l) => (
            <div key={l.id} className={styles.card}>
              <img src={unsplash(l.photo, 360, 220, l.photoCrop)} alt="" loading="lazy" />
              <strong>{listingName(m.listingNames, l)}</strong>
              <small>{place(l)}</small>
            </div>
          ))}
        </div>
      </div>
      {detail ? (
        <div className={`${styles.phone} ${styles.front}`}>
          <div className={styles.screen}>
            <div className={styles.island} />
            <img className={styles.hero} src={unsplash(detail.photo, 360, 420, detail.photoCrop)} alt="" loading="lazy" />
            <div className={styles.detail}>
              <strong>{listingName(m.listingNames, detail)}</strong>
              <small>{place(detail)}</small>
              <span className={styles.ask}>{m.guest.contact.button}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
