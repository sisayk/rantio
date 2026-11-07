/* eslint-disable @next/next/no-img-element -- static photos in /public, sized by CSS */
import { getMessages } from "@/i18n";
import { countryName, fill, languageNamesIn, money } from "@/i18n/format";
import { LANG_INFO, type Lang, LANGS } from "@/i18n/locales";
import { TRIAL } from "@/i18n/messages/trial";
import { paths } from "@/i18n/paths";
import { type ChannelId, CHANNELS } from "@/lib/catalog";
import { NIGHT_PRICES } from "@/lib/content";
import { type Prices, withPrices } from "@/lib/prices";
import { getPrices } from "@/lib/prices.server";
import { type Currency, formatPrice, LANG_CURRENCY, roundNicely } from "@/lib/currency";
import { COUNTRIES } from "@/lib/listings";
import { PHOTOS, SHOWCASE_CARDS } from "@/lib/showcase";
import Estimator from "./Estimator";
import LanguageButton from "./LanguagePicker";
import SignupForm from "./SignupForm";
import HostSwitchLink from "./guest/HostSwitchLink";
import MainNav from "./guest/MainNav";
import { Wordmark } from "./guest/icons";
import g from "./guest/guest.module.css";
import styles from "./landing.module.css";
import MonitorWaitlist from "./MonitorWaitlist";
import monitorPhoto from "@/assets/mokki-monitor.jpg";
import SiteFooter from "./SiteFooter";

// July 2027 at an example Saimaa cottage: the weeks from the owner's current sites stay,
// gaps fill from abroad.
const JULY_OFFSET = 3; // 1 July 2027 is a Thursday
const EXISTING: Record<number, string> = {
  3: "Nettimökki", 4: "Nettimökki", 5: "Nettimökki", 6: "Nettimökki", 7: "Nettimökki", 8: "Nettimökki", 9: "Nettimökki",
  24: "Lomarengas", 25: "Lomarengas", 26: "Lomarengas", 27: "Lomarengas", 28: "Lomarengas", 29: "Lomarengas", 30: "Lomarengas",
};
const EXISTING_STARTS = new Set([3, 24]);

// The local sites a visitor's country uses, as examples under the calendar.
const LOCAL_SITES: Partial<Record<Lang, ChannelId[]>> = {
  sv: ["stugsommar", "novasol"],
  nb: ["finn", "inatur"],
  nn: ["finn", "inatur"],
  da: ["dancenter", "sologstrand"],
};
const FINNISH_SITES: ChannelId[] = ["nettimokki", "lomarengas", "mokkivuokra"];

function siteList(lang: Lang): string {
  const names = (LOCAL_SITES[lang] ?? FINNISH_SITES).map((id) => CHANNELS[id].name);
  try {
    return new Intl.ListFormat(LANG_INFO[lang].intl, { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}
const ADDED: Record<number, string> = {
  11: "Airbnb", 12: "Airbnb", 13: "Airbnb", 14: "Airbnb", 15: "Airbnb",
  17: "Booking.com", 18: "Booking.com", 19: "Booking.com", 20: "Booking.com", 21: "Booking.com",
};
const RUN_STARTS = new Set([11, 17]);

// Mökki monitor features, in the order of messages owner.monitor.features.
const MONITOR_ICONS: Record<string, React.ReactNode> = {
  frost: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" /></svg>,
  power: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.5 5.5 13.5H12l-1 8 7.5-11H12z" /></svg>,
  leak: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></svg>,
  door: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h8A1.5 1.5 0 0 1 16 4.5V21M3 21h18M16 6h2.5V21" /><circle cx="12.5" cy="12.5" r="0.9" /></svg>,
  probes: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0Z" /><path d="M12 9v6.5" /></svg>,
};

// "Why list with Rantio", in the order of owner.why.items: guests abroad, one calendar, control, fees.
const WHY_ICONS = [
  <svg key="a" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5Z" /></svg>,
  <svg key="b" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M9 14.5l2 2 4-4" /></svg>,
  <svg key="c" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>,
  <svg key="d" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
];

const STEP_ICONS = [
  <svg key="a" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></svg>,
  <svg key="b" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.3 10.9 7.4-3.8M8.3 13.1l7.4 3.8" /></svg>,
  <svg key="c" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></svg>,
];

// The price example: 20 extra nights at a typical price, worked out the same way as the
// estimator, in the page's currency (kronor and the Swedish yearly fee on a Swedish page), with the
// prices set in the admin.
function example(currency: Currency, prices: Prices) {
  const vat = 1 + prices.vat / 100;
  const guests = 20 * NIGHT_PRICES[currency].typical;
  const platform = guests * (prices.platformFee / 100);
  const commission = (guests - platform) * (prices.commission / 100) * vat;
  const yearly = prices.yearlyFees[currency] * vat;
  return { guests, platform, commission, yearly, keep: guests - platform - commission - yearly };
}

export default async function Landing({ lang }: { lang: Lang }) {
  const m = getMessages(lang);
  const prices = await getPrices();
  const t = withPrices(lang, m.owner, prices);
  const trial = withPrices(lang, TRIAL[lang], prices);
  const intl = LANG_INFO[lang].intl;
  const eur = (n: number) => money(lang, Math.round(n));
  const currency = LANG_CURRENCY[lang];
  const cash = (n: number) => formatPrice(lang, n, currency);
  const ex = example(currency, prices);
  const fee = cash(prices.yearlyFees[currency]);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  // July 2027 starts on a Thursday; 5–11 July 2027 is a Monday-to-Sunday week.
  const month = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(new Date(2027, 6, 1));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intl, { weekday: "short" }).format(new Date(2027, 6, 5 + i)),
  );
  const priceRows = [
    { label: t.price.rows.guests, value: cash(ex.guests) },
    { label: t.price.rows.platform, value: `−${cash(ex.platform)}` },
    { label: t.price.rows.commission, value: `−${cash(ex.commission)}` },
    { label: fill(lang, t.price.rows.yearly, { fee }), value: `−${cash(ex.yearly)}` },
  ];
  let fillOrder = 0;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={g.brand} href={paths.home(lang)}>
            <Wordmark />
          </a>
          <MainNav lang={lang} labels={m.guest.nav} hostsLabel={m.common.footer.hosts} active="hosts" className={styles.mainNav} />
          <nav className={`${g.detailTopLinks} ${styles.headerNav}`}>
            <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={g.langButton} />
            <HostSwitchLink
              lang={lang}
              becomeHost={t.nav.login}
              switchToHosting={m.guest.menu.switchToHosting}
              signedOutHref={paths.hostingLogin(lang)}
              className={g.hostLink}
            />
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
            <Estimator lang={lang} t={t.hero} prices={prices} />
            <p className={styles.heroLead}>{t.hero.lead}</p>
            <a className={styles.primaryButton} href="#ilmoita">
              {t.hero.cta}
            </a>
          </div>
          <div className={styles.heroPhoto}>
            <img src={PHOTOS.hero.src} alt={t.hero.photoAlt} width={1200} height={1400} fetchPriority="high" />
            <div className={styles.chipSync}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" /></svg>
              {t.hero.chipSync}
            </div>
            <div className={styles.chipBooking}>
              <span className={styles.chipDot} aria-hidden="true" />
              <div>
                <p className={styles.chipTitle}>{t.hero.chipBookingTitle}</p>
                <p className={styles.chipBody}>{t.hero.chipBookingBody}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Rantio in numbers: facts only, no made-up statistics */}
        <section className={styles.factsWrap} aria-label={t.facts.label}>
          <ul className={styles.facts}>
            {[
              [String(Object.keys(CHANNELS).length), t.facts.sites],
              [String(COUNTRIES.length), t.facts.countries],
              [String(LANGS.length), t.facts.languages],
              [cash(0), t.facts.fees],
            ].map(([value, label]) => (
              <li key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Why list with Rantio */}
        <section className={styles.wide} aria-labelledby="why-title">
          <h2 id="why-title" className={styles.sectionTitle}>
            {t.why.title}
          </h2>
          <ul className={styles.why}>
            {t.why.items.map((item, i) => (
              <li key={item.title}>
                <span className={styles.stepIcon}>{WHY_ICONS[i]}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Example listings */}
        <section className={styles.wide} aria-labelledby="listings-title">
          <div className={styles.sectionHead}>
            <h2 id="listings-title" className={styles.sectionTitle}>
              {t.listings.title}
            </h2>
            <p className={styles.sectionLead}>{t.listings.lead}</p>
          </div>
          <ul className={styles.cards}>
            {t.listings.cards.map((card, i) => ({ ...card, ...SHOWCASE_CARDS[i] })).map((card) => (
              <li key={card.title} className={styles.card}>
                <div className={styles.cardPhoto}>
                  <img src={PHOTOS[card.photo].src} alt="" width={800} height={800} loading="lazy" />
                  <span className={styles.cardBadge}>{card.region}</span>
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardFacts}>{card.facts}</p>
                <p className={styles.cardPrice}>
                  <strong>{eur(card.price)}</strong> {t.listings.perNight}
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.cardsNote}>{t.listings.note}</p>
        </section>

        {/* Calendar: the owner's current sites stay, the gaps fill */}
        <section className={`${styles.wide} ${styles.split}`} aria-labelledby="calendar-title">
          <div className={styles.splitPhoto}>
            <img src={PHOTOS.interior.src} alt={t.calendar.photoAlt} width={1000} height={1200} loading="lazy" />
          </div>
          <div className={styles.splitBody}>
            <h2 id="calendar-title" className={styles.sectionTitle}>
              {t.calendar.title}
            </h2>
            <p className={styles.sectionLead}>{t.calendar.lead}</p>
            <figure className={styles.calendar}>
              <figcaption className={styles.calendarMonth}>{month}</figcaption>
              <div className={styles.calendarGrid} role="presentation">
                {weekdays.map((d) => (
                  <span key={d} className={styles.weekday}>
                    {d}
                  </span>
                ))}
                {Array.from({ length: JULY_OFFSET }, (_, i) => (
                  <span key={`blank-${i}`} />
                ))}
                {days.map((day) => {
                  const channel = ADDED[day];
                  const local = EXISTING[day];
                  const kind = channel ? styles.dayAdded : local ? styles.dayExisting : styles.dayFree;
                  const order = channel ? fillOrder++ : 0;
                  const start = (channel && RUN_STARTS.has(day)) || (local && EXISTING_STARTS.has(day));
                  return (
                    <span
                      key={day}
                      className={`${styles.day} ${kind} ${start ? styles.dayRunStart : ""}`}
                      style={channel ? ({ "--i": order } as React.CSSProperties) : undefined}
                      title={channel ?? local}
                    >
                      {day}
                      {start ? <em className={styles.dayChannel}>{channel ?? local}</em> : null}
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
            <p className={styles.legendNote}>{fill(lang, t.calendar.examples, { sites: siteList(lang) })}</p>
          </div>
        </section>

        {/* Owners who aren't listed anywhere yet */}
        <section className={styles.wide} aria-labelledby="scratch-title">
          <div className={styles.scratch}>
            <div>
              <h2 id="scratch-title" className={styles.sectionTitle}>
                {trial.scratchTitle}
              </h2>
              <p className={styles.sectionLead}>{trial.scratchBody}</p>
            </div>
            <div className={styles.scratchSide}>
              <ul className={styles.scratchPoints}>
                {trial.scratchPoints.map((point) => (
                  <li key={point}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
              <a className={styles.primaryButton} href="#ilmoita">
                {t.hero.cta}
              </a>
            </div>
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
                <span className={styles.stepIcon}>
                  {STEP_ICONS[i]}
                  <span className={styles.stepNumber} aria-hidden="true">
                    {i + 1}
                  </span>
                </span>
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
              {fill(lang, t.price.title, { fee })}
            </h2>
            <p className={styles.sectionLead}>{t.price.lead}</p>
            <div className={styles.priceTrial}>
              <span className={styles.trialBadge}>{trial.badge}</span>
              <p>{trial.priceNote}</p>
            </div>
            <p className={styles.priceTerms}>{t.price.terms}</p>
          </div>
          <div className={styles.priceCard}>
            <h3 className={styles.priceCardTitle}>{fill(lang, t.price.exampleTitle, { price: cash(NIGHT_PRICES[currency].typical) })}</h3>
            <dl className={styles.priceRows}>
              {priceRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className={styles.priceTotal}>
                <dt>{t.price.total}</dt>
                <dd>{t.price.about.replace("{amount}", cash(roundNicely(ex.keep, currency)))}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Mökki monitor: the cottage alert box, coming soon */}
        <section id="monitor" className={`${styles.wide} ${styles.monitor}`} aria-labelledby="monitor-title">
          <div className={styles.monitorTop}>
            <figure className={styles.monitorPhoto}>
              <img src={monitorPhoto.src} alt={t.monitor.photoAlt} width={1200} height={900} loading="lazy" />
              <div className={styles.chipBooking}>
                <span className={`${styles.chipDot} ${styles.chipDotCold}`} aria-hidden="true" />
                <div>
                  <p className={styles.chipTitle}>{t.monitor.chipTitle}</p>
                  <p className={styles.chipBody}>{t.monitor.chipBody}</p>
                </div>
              </div>
              <figcaption>{t.monitor.caption}</figcaption>
            </figure>
            <div className={styles.monitorBody}>
              <span className={styles.monitorBadge}>{t.monitor.badge}</span>
              <h2 id="monitor-title" className={styles.sectionTitle}>
                {t.monitor.title}
              </h2>
              <p className={styles.sectionLead}>{t.monitor.lead}</p>
              <p className={styles.monitorApp}>{t.monitor.app}</p>
              <MonitorWaitlist lang={lang} t={t.monitor} privacyLink={t.form.privacyLink} />
            </div>
          </div>
          <ul className={styles.monitorFeatures}>
            {t.monitor.features.map((feature) => (
              <li key={feature.key}>
                <span className={styles.stepIcon}>{MONITOR_ICONS[feature.key]}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ul>
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
            <img src={PHOTOS.winter.src} alt={t.form.photoAlt} width={1000} height={1300} loading="lazy" />
            <div className={styles.formPhotoCard}>
              <p className={styles.chipTitle}>{t.form.asideTitle}</p>
              <p className={styles.chipBody}>{t.form.asideBody}</p>
            </div>
          </div>
          <div className={styles.formCard}>
            <h2 id="form-title" className={styles.sectionTitle}>
              {t.form.title}
            </h2>
            <p className={styles.sectionLead}>{t.form.lead}</p>
            <SignupForm lang={lang} f={t.form} prices={prices} countries={Object.fromEntries(COUNTRIES.map((c) => [c, countryName(lang, c)]))} />
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} variant="hosts" />
    </>
  );
}
