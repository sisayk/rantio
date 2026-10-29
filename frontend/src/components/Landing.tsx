/* eslint-disable @next/next/no-img-element -- static photos in /public, sized by CSS */
import { CONTACT_EMAIL, content, type Lang } from "@/lib/content";
import { PHOTOS, showcase } from "@/lib/showcase";
import Estimator from "./Estimator";
import SignupForm from "./SignupForm";
import styles from "./landing.module.css";

// July 2027 at an example Saimaa cottage: Nettimökki weeks stay, gaps fill from abroad.
const JULY_OFFSET = 3; // 1 July 2027 is a Thursday
const EXISTING = new Set([3, 4, 5, 6, 7, 8, 9, 24, 25, 26, 27, 28, 29, 30]);
const ADDED: Record<number, string> = {
  11: "Airbnb", 12: "Airbnb", 13: "Airbnb", 14: "Airbnb", 15: "Airbnb",
  17: "Booking.com", 18: "Booking.com", 19: "Booking.com", 20: "Booking.com", 21: "Booking.com",
};
const RUN_STARTS = new Set([11, 17]);

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M4 14 14 5l10 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 12.5V23h13V12.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 23v-5h4v5" fill="none" stroke="var(--berry)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

const STEP_ICONS = [
  <svg key="a" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></svg>,
  <svg key="b" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.3 10.9 7.4-3.8M8.3 13.1l7.4 3.8" /></svg>,
  <svg key="c" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></svg>,
];

export default function Landing({ lang }: { lang: Lang }) {
  const t = content[lang];
  const s = showcase[lang];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  let fillOrder = 0;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href={lang === "fi" ? "/" : "/en"}>
            <Mark />
            <span>Stugora</span>
          </a>
          <nav className={styles.headerNav}>
            <a className={styles.langLink} href={t.nav.otherHref} hrefLang={lang === "fi" ? "en" : "fi"}>
              {t.nav.otherLang}
            </a>
            <a className={styles.langLink} href={t.nav.loginHref}>
              {t.nav.login}
            </a>
            <a className={styles.headerCta} href="#ilmoita">
              {t.nav.cta}
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: the estimate beside the kind of cottage guests are looking for */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Estimator lang={lang} />
            <p className={styles.heroLead}>{t.hero.lead}</p>
            <a className={styles.primaryButton} href="#ilmoita">
              {t.hero.cta}
            </a>
          </div>
          <div className={styles.heroPhoto}>
            <img src={PHOTOS.hero.src} alt={s.heroAlt} width={1200} height={1400} fetchPriority="high" />
            <div className={styles.chipSync}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" /></svg>
              {s.chipSync}
            </div>
            <div className={styles.chipBooking}>
              <span className={styles.chipDot} aria-hidden="true" />
              <div>
                <p className={styles.chipTitle}>{s.chipBooking.title}</p>
                <p className={styles.chipBody}>{s.chipBooking.body}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Example listings */}
        <section className={styles.wide} aria-labelledby="listings-title">
          <div className={styles.sectionHead}>
            <h2 id="listings-title" className={styles.sectionTitle}>
              {s.listings.title}
            </h2>
            <p className={styles.sectionLead}>{s.listings.lead}</p>
          </div>
          <ul className={styles.cards}>
            {s.listings.cards.map((card) => (
              <li key={card.title} className={styles.card}>
                <div className={styles.cardPhoto}>
                  <img src={PHOTOS[card.photo].src} alt="" width={800} height={800} loading="lazy" />
                  <span className={styles.cardBadge}>{card.region}</span>
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardFacts}>{card.facts}</p>
                <p className={styles.cardPrice}>
                  <strong>{card.price}</strong> {s.listings.perNight}
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.cardsNote}>{s.listings.note}</p>
        </section>

        {/* Calendar: Nettimökki stays, the gaps fill */}
        <section className={`${styles.wide} ${styles.split}`} aria-labelledby="calendar-title">
          <div className={styles.splitPhoto}>
            <img src={PHOTOS.interior.src} alt={s.calendarAlt} width={1000} height={1200} loading="lazy" />
          </div>
          <div className={styles.splitBody}>
            <h2 id="calendar-title" className={styles.sectionTitle}>
              {t.calendar.title}
            </h2>
            <p className={styles.sectionLead}>{t.calendar.lead}</p>
            <figure className={styles.calendar}>
              <figcaption className={styles.calendarMonth}>{t.calendar.month}</figcaption>
              <div className={styles.calendarGrid} role="presentation">
                {t.calendar.weekdays.map((d) => (
                  <span key={d} className={styles.weekday}>
                    {d}
                  </span>
                ))}
                {Array.from({ length: JULY_OFFSET }, (_, i) => (
                  <span key={`blank-${i}`} />
                ))}
                {days.map((day) => {
                  const channel = ADDED[day];
                  const kind = channel ? styles.dayAdded : EXISTING.has(day) ? styles.dayExisting : styles.dayFree;
                  const order = channel ? fillOrder++ : 0;
                  const start = channel && RUN_STARTS.has(day);
                  return (
                    <span
                      key={day}
                      className={`${styles.day} ${kind} ${start ? styles.dayRunStart : ""}`}
                      style={channel ? ({ "--i": order } as React.CSSProperties) : undefined}
                      title={channel ?? (EXISTING.has(day) ? "Nettimökki" : undefined)}
                    >
                      {day}
                      {start ? <em className={styles.dayChannel}>{channel}</em> : null}
                    </span>
                  );
                })}
              </div>
            </figure>
            <ul className={styles.legend}>
              <li>
                <span className={styles.swatchExisting} /> {t.calendar.existing}
              </li>
              <li>
                <span className={styles.swatchAdded} /> {t.calendar.added}
              </li>
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className={styles.wide} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.sectionTitle}>
            {t.how.title}
          </h2>
          <ol className={styles.steps}>
            {t.how.steps.map((step, i) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepIcon}>{STEP_ICONS[i]}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Price */}
        <section className={`${styles.wide} ${styles.twoCol}`} aria-labelledby="price-title">
          <div>
            <h2 id="price-title" className={styles.sectionTitle}>
              {t.price.title}
            </h2>
            <p className={styles.sectionLead}>{t.price.lead}</p>
            <p className={styles.priceTerms}>{t.price.terms}</p>
          </div>
          <div className={styles.priceCard}>
            <h3 className={styles.priceCardTitle}>{t.price.exampleTitle}</h3>
            <dl className={styles.priceRows}>
              {t.price.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className={styles.priceTotal}>
                <dt>{t.price.total.label}</dt>
                <dd>{t.price.total.value}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* FAQ */}
        <section className={`${styles.wide} ${styles.twoCol}`} aria-labelledby="faq-title">
          <h2 id="faq-title" className={styles.sectionTitle}>
            {t.faq.title}
          </h2>
          <div className={styles.faq}>
            {t.faq.items.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Sign-up */}
        <section id="ilmoita" className={`${styles.wide} ${styles.formSplit}`} aria-labelledby="form-title">
          <div className={styles.formPhoto}>
            <img src={PHOTOS.winter.src} alt={s.formAlt} width={1000} height={1300} loading="lazy" />
            <div className={styles.formPhotoCard}>
              <p className={styles.chipTitle}>{s.formAside.title}</p>
              <p className={styles.chipBody}>{s.formAside.body}</p>
            </div>
          </div>
          <div className={styles.formCard}>
            <h2 id="form-title" className={styles.sectionTitle}>
              {t.form.title}
            </h2>
            <p className={styles.sectionLead}>{t.form.lead}</p>
            <SignupForm lang={lang} />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>{t.footer.note}</p>
        <p>
          {t.footer.contact}: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </footer>
    </>
  );
}
