/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */
import { getMessages } from "@/i18n";
import { countryName, currencyNames, languageNamesIn, number, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { activitiesFor } from "@/lib/activities";
import { CHANNELS, channelIcon, FEATURE_GROUPS } from "@/lib/catalog";
import { CONTACT_EMAIL } from "@/lib/content";
import { type Listing, listingCurrency, listingName, listingPhotos } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import CurrencyButton from "../CurrencyButton";
import LanguageButton from "../LanguagePicker";
import DetailGallery from "./DetailGallery";
import HostSwitchLink from "./HostSwitchLink";
import ListingPrice from "./ListingPrice";
import { ActivityIcon, ArrowLeft, Bed, CategoryIcon, Check, Logo, People, Star } from "./icons";
import ContactOwner from "./ContactOwner";
import Surroundings from "./Surroundings";
import styles from "./guest.module.css";
import AppBadges from "../AppBadges";

export default function CottageDetail({ lang, listing: l }: { lang: Lang; listing: Listing }) {
  const m = getMessages(lang);
  const t = m.guest;
  const d = t.detail;
  const home = paths.home(lang);
  const name = listingName(m.listingNames, l);
  const country = countryName(lang, l.country);
  const region = PLACES[l.country].find((r) => r.id === l.region);
  const activities = activitiesFor(l, m.activities);
  const amenities = FEATURE_GROUPS.filter((g) => g.id !== "booking")
    .map((g) => ({
      id: g.id,
      title: m.catalog.groups[g.id],
      items: g.options.filter((k) => (l.features as string[]).includes(k)).map((k) => m.catalog.features[k]),
    }))
    .filter((g) => g.items.length);

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailTop}>
        <a className={styles.brand} href={home}>
          <Logo className={styles.logo} />
          Stugora
        </a>
        <div className={styles.detailTopLinks}>
          <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.langButton} />
          <CurrencyButton lang={lang} t={t.currency} names={currencyNames(lang)} className={styles.langButton} />
          <HostSwitchLink lang={lang} becomeHost={t.becomeHost} switchToHosting={t.menu.switchToHosting} className={styles.hostLink} />
        </div>
      </header>

      <main className={styles.detail}>
        <nav className={styles.crumbs} aria-label={d.breadcrumb}>
          <a href={home}>
            <ArrowLeft className={styles.icon16} />
            {d.back}
          </a>
          <span aria-hidden="true">/</span>
          <span>{country}</span>
          {region ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{regionLabel(region, l.country, lang)}</span>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span>{l.city}</span>
        </nav>

        <div className={styles.detailHead}>
          <h1>{name}</h1>
          <p>
            {l.place}, {country}
            <span aria-hidden="true"> · </span>
            {l.rating ? (
              <span className={styles.rating}>
                <Star className={styles.icon16} />
                {number(lang, l.rating, { min: 1, max: 1 })}
              </span>
            ) : (
              <span className={styles.newTag}>{t.card.isNew}</span>
            )}
          </p>
        </div>

        <DetailGallery lang={lang} photos={listingPhotos(l)} name={name} t={t.photos} />

        <div className={styles.detailColumns}>
          <div className={styles.detailMain}>
            <section className={styles.detailFacts} aria-label={d.facts}>
              <span>
                <People className={styles.icon20} />
                {plural(lang, t.units.guests, l.guests)}
              </span>
              <span>
                <Bed className={styles.icon20} />
                {plural(lang, t.units.bedrooms, l.bedrooms)}
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
                        {m.activities.seasons[a.season]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <Surroundings lang={lang} t={d} lat={l.lat} lng={l.lng} />

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
            <ListingPrice lang={lang} amount={l.price} currency={listingCurrency(l)} night={t.card.night} t={t.currency} />
            <ul className={styles.bookFlags}>
              {(["instantBook", "freeCancellation"] as const)
                .filter((k) => (l.features as string[]).includes(k))
                .map((k) => (
                  <li key={k}>
                    <Check className={styles.icon16} />
                    {m.catalog.features[k]}
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
            <ContactOwner lang={lang} listingId={l.id} cottage={name} maxGuests={l.guests} t={t.contact} />
            <p className={styles.bookNote}>{d.bookNote}</p>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <AppBadges t={m.common.apps} />
        <p>{m.common.footer.note}</p>
        <p>
          {m.common.footer.contact}: <span className={styles.selectable}>{CONTACT_EMAIL}</span>
        </p>
      </footer>
    </div>
  );
}
