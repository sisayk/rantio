/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */
// Experiences, Destinations and Inspiration: the guest menu's pages after Stays.
// Server components; the only client parts are the header's language, currency and host buttons.
import { getMessages } from "@/i18n";
import { countryName, currencyNames, fill, languageNamesIn, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import {
  countCottages,
  cottagesHref,
  destination,
  EXPERIENCE_IDS,
  EXPERIENCES,
  GUIDE_IDS,
  type GuideId,
  GUIDES,
  readingMinutes,
} from "@/lib/explore";
import { COUNTRIES, unsplash } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import AppBadges from "../AppBadges";
import CurrencyButton from "../CurrencyButton";
import LanguageButton from "../LanguagePicker";
import HostSwitchLink from "../guest/HostSwitchLink";
import { ActivityIcon, ArrowLeft, Wordmark } from "../guest/icons";
import MainNav, { type NavPage } from "../guest/MainNav";
import g from "../guest/guest.module.css";
import s from "./explore.module.css";

function Shell({ lang, active, children }: { lang: Lang; active: NavPage; children: React.ReactNode }) {
  const m = getMessages(lang);
  const t = m.guest;
  return (
    <div className={`${g.page} ${s.page}`}>
      <header className={s.top}>
        <div className={s.topInner}>
          <a className={g.brand} href={paths.home(lang)}>
            <Wordmark />
          </a>
          <MainNav lang={lang} labels={t.nav} active={active} className={s.nav} />
          <div className={`${g.detailTopLinks} ${s.links}`}>
            <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={g.langButton} />
            <CurrencyButton lang={lang} t={t.currency} names={currencyNames(lang)} className={g.langButton} />
            <HostSwitchLink lang={lang} becomeHost={t.becomeHost} switchToHosting={t.menu.switchToHosting} className={g.hostLink} />
          </div>
        </div>
      </header>

      <main className={s.main}>{children}</main>

      <footer className={`${g.footer} ${s.footer}`}>
        <AppBadges t={m.common.apps} />
        <p>{m.common.footer.note}</p>
        <p className={g.footerLinks}>
          <span>
            {m.common.footer.contact}: <span className={g.selectable}>{CONTACT_EMAIL}</span>
          </span>
          <a href={paths.privacy(lang)}>{m.common.footer.privacy}</a>
          <a href={paths.terms(lang)}>{m.common.footer.terms}</a>
        </p>
      </footer>
    </div>
  );
}

function Head({ title, lead }: { title: string; lead: string }) {
  return (
    <div className={s.head}>
      <h1>{title}</h1>
      <p>{lead}</p>
    </div>
  );
}

// ---------- Experiences ----------
export function ExperiencesPage({ lang }: { lang: Lang }) {
  const m = getMessages(lang);
  const x = m.explore;
  const e = x.experiences;
  return (
    <Shell lang={lang} active="experiences">
      <Head title={e.title} lead={e.lead} />
      <ul className={s.grid}>
        {EXPERIENCE_IDS.map((id) => {
          const ex = EXPERIENCES[id];
          const n = countCottages(ex.query);
          return (
            <li key={id}>
              <a className={s.card} href={cottagesHref(lang, ex.query)}>
                <span className={s.photo}>
                  <img src={unsplash(ex.photo, 720, 560)} alt="" loading="lazy" />
                  <span className={s.badge}>
                    <ActivityIcon activity={ex.icon} className={s.badgeIcon} />
                    {x.seasons[ex.season]}
                  </span>
                </span>
                <h2>{e.items[id].title}</h2>
                <p>{e.items[id].body}</p>
                <span className={s.more}>{plural(lang, x.cottagesLink, n)}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className={s.note}>{e.note}</p>
    </Shell>
  );
}

// ---------- Destinations ----------
export function DestinationsPage({ lang }: { lang: Lang }) {
  const m = getMessages(lang);
  const x = m.explore;
  const d = x.destinations;
  return (
    <Shell lang={lang} active="destinations">
      <Head title={d.title} lead={d.lead} />
      <ul className={s.destGrid}>
        {COUNTRIES.map((c) => {
          const info = destination(c);
          const name = countryName(lang, c);
          const all = cottagesHref(lang, { country: c });
          return (
            <li key={c} className={s.dest}>
              <a className={s.destPhoto} href={all} tabIndex={-1} aria-hidden="true">
                {info.photo ? <img src={unsplash(info.photo, 960, 540)} alt="" loading="lazy" /> : null}
              </a>
              <div className={s.destBody}>
                <h2>
                  <a href={all}>{name}</a>
                </h2>
                <p>{d.countries[c]}</p>
                {info.regions.length ? (
                  <div>
                    <p className={s.label}>{d.regions}</p>
                    <ul className={s.chips}>
                      {info.regions.map((r) => {
                        const region = PLACES[c].find((p) => p.id === r.id);
                        if (!region) return null;
                        return (
                          <li key={r.id}>
                            <a href={cottagesHref(lang, { country: c, region: r.id })}>
                              {regionLabel(region, c, lang)}
                              <span className={s.chipCount}>{r.count}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <a className={s.more} href={all}>
                  {fill(lang, d.allIn, { country: name })} ({info.count})
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

// ---------- Inspiration ----------
function guideMinutes(lang: Lang, id: GuideId) {
  const m = getMessages(lang);
  const guide = m.explore.guides[id];
  const n = readingMinutes([guide.title, guide.lead, ...guide.sections.flatMap((x) => [x.heading, x.body])]);
  return plural(lang, m.explore.inspiration.minutes, n);
}

function GuideCards({ lang, ids }: { lang: Lang; ids: readonly GuideId[] }) {
  const m = getMessages(lang);
  return (
    <ul className={s.grid}>
      {ids.map((id) => {
        const guide = m.explore.guides[id];
        return (
          <li key={id}>
            <a className={s.card} href={paths.guide(lang, id)}>
              <span className={s.photo}>
                <img src={unsplash(GUIDES[id].photo, 720, 560)} alt="" loading="lazy" />
              </span>
              <span className={s.meta}>{guideMinutes(lang, id)}</span>
              <h2>{guide.title}</h2>
              <p>{guide.lead}</p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function InspirationPage({ lang }: { lang: Lang }) {
  const m = getMessages(lang);
  const ins = m.explore.inspiration;
  const [first, ...rest] = GUIDE_IDS;
  const top = m.explore.guides[first];
  return (
    <Shell lang={lang} active="inspiration">
      <Head title={ins.title} lead={ins.lead} />
      <a className={s.featured} href={paths.guide(lang, first)}>
        <img src={unsplash(GUIDES[first].photo, 1200, 760)} alt="" />
        <span className={s.featuredBody}>
          <span className={s.meta}>{guideMinutes(lang, first)}</span>
          <span className={s.featuredTitle}>{top.title}</span>
          <span className={s.featuredLead}>{top.lead}</span>
          <span className={s.button}>{ins.read}</span>
        </span>
      </a>
      <GuideCards lang={lang} ids={rest} />
    </Shell>
  );
}

export function GuidePage({ lang, id }: { lang: Lang; id: GuideId }) {
  const m = getMessages(lang);
  const ins = m.explore.inspiration;
  const guide = m.explore.guides[id];
  const query = GUIDES[id].query;
  return (
    <Shell lang={lang} active="inspiration">
      <article className={s.article}>
        <a className={s.back} href={paths.inspiration(lang)}>
          <ArrowLeft className={g.icon16} />
          {ins.back}
        </a>
        <p className={s.meta}>{guideMinutes(lang, id)}</p>
        <h1>{guide.title}</h1>
        <p className={s.articleLead}>{guide.lead}</p>
        <img className={s.articlePhoto} src={unsplash(GUIDES[id].photo, 1400, 790)} alt="" />
        {guide.sections.map((sec) => (
          <section key={sec.heading}>
            <h2>{sec.heading}</h2>
            <p>{sec.body}</p>
          </section>
        ))}
        <div className={s.cta}>
          <h2>{ins.ctaTitle}</h2>
          <a className={s.button} href={cottagesHref(lang, query)}>
            {plural(lang, m.explore.cottagesLink, countCottages(query))}
          </a>
        </div>
      </article>
      <section className={s.moreGuides}>
        <h2>{ins.more}</h2>
        <GuideCards lang={lang} ids={GUIDE_IDS.filter((other) => other !== id)} />
      </section>
    </Shell>
  );
}
