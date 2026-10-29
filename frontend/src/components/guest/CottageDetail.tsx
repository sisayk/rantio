/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */
import { activitiesFor, SEASON_LABEL } from "@/lib/activities";
import { CHANNELS, channelIcon, FEATURE_GROUPS } from "@/lib/catalog";
import { CONTACT_EMAIL, type Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import { cottageHref, type Listing, unsplash } from "@/lib/listings";
import { PLACES } from "@/lib/places";
import { ActivityIcon, ArrowLeft, Bed, CategoryIcon, Check, Globe, Logo, People, Star } from "./icons";
import Surroundings from "./Surroundings";
import styles from "./guest.module.css";

export default function CottageDetail({ lang, listing: l }: { lang: Lang; listing: Listing }) {
  const t = guestContent[lang];
  const d = t.detail;
  const home = lang === "fi" ? "/" : "/en";
  const other: Lang = lang === "fi" ? "en" : "fi";
  const region = PLACES[l.country].find((r) => r.id === l.region);
  const money = new Intl.NumberFormat(t.locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const activities = activitiesFor(l, lang);
  const amenities = FEATURE_GROUPS.filter((g) => g.id !== "booking")
    .map((g) => ({
      id: g.id,
      title: g.title[lang],
      items: Object.entries(g.options as Record<string, Record<Lang, string>>)
        .filter(([k]) => (l.features as string[]).includes(k))
        .map(([, label]) => label[lang]),
    }))
    .filter((g) => g.items.length);
  const booking = FEATURE_GROUPS[0].options;

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailTop}>
        <a className={styles.brand} href={home}>
          <Logo className={styles.logo} />
          Stugora
        </a>
        <div className={styles.detailTopLinks}>
          <a className={styles.langButton} href={cottageHref(other, l.id)} hrefLang={other}>
            <Globe className={styles.icon18} />
            {t.langOther.label}
          </a>
          <a className={styles.hostLink} href={t.becomeHost.href}>
            {t.becomeHost.label}
          </a>
        </div>
      </header>

      <main className={styles.detail}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <a href={home}>
            <ArrowLeft className={styles.icon16} />
            {d.back}
          </a>
          <span aria-hidden="true">/</span>
          <span>{t.countries[l.country]}</span>
          {region ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{region.name[lang]}</span>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span>{l.city}</span>
        </nav>

        <div className={styles.detailHead}>
          <h1>{l.name[lang]}</h1>
          <p>
            {l.place}, {t.countries[l.country]}
            <span aria-hidden="true"> · </span>
            {l.rating ? (
              <span className={styles.rating}>
                <Star className={styles.icon16} />
                {l.rating.toLocaleString(t.locale, { minimumFractionDigits: 1 })}
              </span>
            ) : (
              <span className={styles.newTag}>{t.card.isNew}</span>
            )}
          </p>
        </div>

        <figure className={styles.detailPhoto}>
          <img src={unsplash(l.photo, 1600, 760, l.photoCrop)} alt="" width={1600} height={760} />
        </figure>

        <div className={styles.detailColumns}>
          <div className={styles.detailMain}>
            <section className={styles.detailFacts} aria-label={t.filters.filters}>
              <span>
                <People className={styles.icon20} />
                {t.card.guests(l.guests)}
              </span>
              <span>
                <Bed className={styles.icon20} />
                {t.card.bedrooms(l.bedrooms)}
              </span>
              {l.categories.map((c) => (
                <span key={c}>
                  <CategoryIcon category={c} className={styles.icon20} />
                  {t.badges[c]}
                </span>
              ))}
            </section>

            <section className={styles.detailSection} aria-labelledby="todo-title">
              <h2 id="todo-title">{d.activitiesTitle}</h2>
              <p className={styles.sectionLead}>{d.activitiesLead}</p>
              <ul className={styles.activityGrid}>
                {activities.map((a) => (
                  <li key={a.id} className={styles.activity}>
                    <span className={styles.activityIcon}>
                      <ActivityIcon activity={a.id} className={styles.icon22} />
                    </span>
                    <div>
                      <h3>{a.title}</h3>
                      <p>{a.body}</p>
                      <span className={styles.season} data-season={a.season}>
                        {SEASON_LABEL[a.season][lang]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <Surroundings lang={lang} lat={l.lat} lng={l.lng} />

            <section className={styles.detailSection} aria-labelledby="amenities-title">
              <h2 id="amenities-title">{d.amenitiesTitle}</h2>
              <div className={styles.amenityGroups}>
                {amenities.map((g) => (
                  <div key={g.id}>
                    <h3>{g.title}</h3>
                    <ul>
                      {g.items.map((item) => (
                        <li key={item}>
                          <Check className={styles.icon16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.bookCard}>
            <p className={styles.bookPrice}>
              <strong>{money.format(l.price)}</strong> {t.card.night}
            </p>
            <ul className={styles.bookFlags}>
              {(["instantBook", "freeCancellation"] as const)
                .filter((k) => (l.features as string[]).includes(k))
                .map((k) => (
                  <li key={k}>
                    <Check className={styles.icon16} />
                    {booking[k][lang]}
                  </li>
                ))}
            </ul>
            <h2>{d.bookTitle}</h2>
            <ul className={styles.bookSites}>
              {l.channels.map((id) => (
                <li key={id}>
                  <span className={styles.channelIcon}>
                    <span className={styles.channelLetter} aria-hidden="true">
                      {CHANNELS[id].name.charAt(0)}
                    </span>
                    <img src={channelIcon(id)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
                  </span>
                  {CHANNELS[id].name}
                </li>
              ))}
            </ul>
            <p className={styles.bookNote}>{d.bookNote}</p>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>{t.footer.note}</p>
        <p>
          {t.footer.contact}: <span className={styles.selectable}>{CONTACT_EMAIL}</span>
        </p>
      </footer>
    </div>
  );
}
