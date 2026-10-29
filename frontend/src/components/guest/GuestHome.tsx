"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CONTACT_EMAIL, type Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import type { DateRange } from "react-day-picker";
import { FEATURE_GROUPS, type FeatureKey } from "@/lib/catalog";
import {
  CATEGORIES,
  type Category,
  COUNTRIES,
  type Country,
  HERO_PHOTO,
  LISTINGS,
  type Listing,
  unsplash,
} from "@/lib/listings";
import { type City, PLACES } from "@/lib/places";
import ChannelIcons from "./ChannelIcons";
import type { MapFocus } from "./CottageMap";
import FiltersModal, { countFilters, EMPTY_FILTERS, type FilterState } from "./FiltersModal";
import { DatePanel, GuestPanel, type Guests } from "./Pickers";
import {
  Bed,
  CalendarIcon,
  CategoryIcon,
  Chevron,
  Globe,
  Heart,
  ListIcon,
  Logo,
  MapIcon,
  People,
  Pin,
  SearchIcon,
  Sliders,
  Star,
  UserIcon,
} from "./icons";
import styles from "./guest.module.css";

// Leaflet needs the browser, so the map loads on the client only.
const CottageMap = dynamic(() => import("./CottageMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} />,
});

type Sort = "recommended" | "priceLow" | "priceHigh" | "guests";
type Menu = null | "dates" | "guests" | "guestsBar" | "account";

// Which filter section each option belongs to, and whether a cottage needs one or all of them.
const GROUP_OF = new Map<FeatureKey, { id: string; match: "any" | "all" }>(
  FEATURE_GROUPS.flatMap((g) =>
    Object.keys(g.options).map((k) => [k as FeatureKey, { id: g.id, match: g.match }] as const),
  ),
);

function matchesFilters(features: FeatureKey[], bedrooms: number, rating: number | undefined, f: FilterState) {
  const byGroup = new Map<string, FeatureKey[]>();
  for (const k of f.features) {
    const g = GROUP_OF.get(k);
    if (g) byGroup.set(g.id, [...(byGroup.get(g.id) ?? []), k]);
  }
  for (const [id, keys] of byGroup) {
    const any = FEATURE_GROUPS.find((g) => g.id === id)?.match === "any";
    if (any ? !keys.some((k) => features.includes(k)) : !keys.every((k) => features.includes(k))) return false;
  }
  if (f.bedrooms.length && !f.bedrooms.some((n) => (n === 4 ? bedrooms >= 4 : bedrooms === n))) return false;
  if (f.rating4 && !(rating && rating > 4)) return false;
  return true;
}

// Suggestions under the search box; countries are added in the visitor's language.
const SUGGESTED = Array.from(new Set(LISTINGS.flatMap((l) => l.place.split(", "))));

const REGION_NAMES = new Map(
  Object.values(PLACES).flat().map((r) => [r.id, `${r.name.en} ${r.name.fi} ${r.name.local}`]),
);

// The box that holds a set of points, padded so a single town still gets some context.
function boxAround(points: { lat: number; lng: number }[], pad: number): MapFocus["bounds"] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lats) - pad, Math.min(...lngs) - pad * 2],
    [Math.max(...lats) + pad, Math.max(...lngs) + pad * 2],
  ];
}
const SAVED_KEY = "stugora:saved";

// Saved cottages live in this browser only (localStorage, with an in-memory fallback).
let memorySaved: string | null = null;
const savedStore = {
  read(): string {
    if (memorySaved !== null) return memorySaved;
    try {
      return localStorage.getItem(SAVED_KEY) ?? "[]";
    } catch {
      return "[]";
    }
  },
  write(ids: string[]) {
    memorySaved = JSON.stringify(ids);
    try {
      localStorage.setItem(SAVED_KEY, memorySaved);
    } catch {
      /* kept in memory for this visit */
    }
    window.dispatchEvent(new Event("stugora-saved"));
  },
  subscribe(callback: () => void) {
    window.addEventListener("stugora-saved", callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener("stugora-saved", callback);
      window.removeEventListener("storage", callback);
    };
  },
};

function parseSaved(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function normalise(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function GuestHome({ lang }: { lang: Lang }) {
  const t = guestContent[lang];
  const money = useMemo(
    () => new Intl.NumberFormat(t.locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    [t.locale],
  );

  const [where, setWhere] = useState("");
  const [dates, setDates] = useState<DateRange | undefined>();
  const [today, setToday] = useState<Date | null>(null);
  const [party, setParty] = useState<Guests>({ adults: 0, children: 0 });
  const guests = party.adults + party.children;
  const [category, setCategory] = useState<Category>("all");
  const [country, setCountry] = useState<Country | "">("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(0);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [savedOnly, setSavedOnly] = useState(false);
  const savedRaw = useSyncExternalStore(savedStore.subscribe, savedStore.read, () => "[]");
  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw]);
  const [menu, setMenu] = useState<Menu>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setMenu(null);
        return;
      }
      if (!(event.target as HTMLElement).closest("[data-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  function toggleSaved(id: string) {
    savedStore.write(saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id]);
  }

  function toggleFeature(k: FeatureKey, on: boolean) {
    setFilters((f) => ({
      ...f,
      features: on ? [...f.features.filter((x) => x !== k), k] : f.features.filter((x) => x !== k),
    }));
  }

  function openDates() {
    if (!today) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setToday(d);
    }
    setMenu(menu === "dates" ? null : "dates");
  }

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short" }),
    [t.locale],
  );
  const datesText = dates?.from
    ? `${dayFormat.format(dates.from)}${dates.to ? ` – ${dayFormat.format(dates.to)}` : ""}`
    : "";
  const guestsText = guests ? t.guestSummary(party.adults, party.children) : "";

  function clearAll() {
    setWhere("");
    setDates(undefined);
    setParty({ adults: 0, children: 0 });
    setCategory("all");
    setCountry("");
    setRegion("");
    setCity("");
    setMaxPrice(0);
    setFilters(EMPTY_FILTERS);
    setSavedOnly(false);
    setMenu(null);
  }

  const results = useMemo(() => {
    const q = normalise(where.trim());
    const list = LISTINGS.filter((l) => {
      const countryNames = `${guestContent.fi.countries[l.country]} ${guestContent.en.countries[l.country]}`;
      const haystack = `${l.place} ${l.name.fi} ${l.name.en} ${countryNames} ${REGION_NAMES.get(l.region) ?? ""}`;
      if (q && !normalise(haystack).includes(q)) return false;
      if (category !== "all" && !l.categories.includes(category)) return false;
      if (country && l.country !== country) return false;
      if (region && l.region !== region) return false;
      if (city && l.city !== city) return false;
      if (maxPrice && l.price > maxPrice) return false;
      if (guests && l.guests < guests) return false;
      if (!matchesFilters(l.features, l.bedrooms, l.rating, filters)) return false;
      if (savedOnly && !saved.includes(l.id)) return false;
      return true;
    });
    if (sort === "priceLow") list.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") list.sort((a, b) => b.price - a.price);
    if (sort === "guests") list.sort((a, b) => b.guests - a.guests);
    return list;
  }, [where, category, country, region, city, maxPrice, guests, filters, savedOnly, saved, sort]);

  const advancedCount = countFilters(filters);

  const regions = country ? PLACES[country] : [];
  const regionData = useMemo(
    () => (country ? PLACES[country].find((r) => r.id === region) : undefined),
    [country, region],
  );
  const regionCities = useMemo<City[]>(() => regionData?.cities ?? [], [regionData]);
  const regionName = (r: { name: { en: string; fi: string } }) => (lang === "fi" ? r.name.fi : r.name.en);

  // The map follows the narrowest place chosen: town, then region, then country.
  const focus = useMemo<MapFocus>(() => {
    const town = regionCities.find((c) => c.name === city);
    if (town) return { bounds: boxAround([town], 0.12), maxZoom: 11 };
    if (regionData) return { bounds: boxAround([...regionData.cities, ...results], 0.05), maxZoom: 10 };
    if (country) return { bounds: boxAround(PLACES[country].flatMap((r) => r.cities), 0.2), maxZoom: 7 };
    const shown = results.length ? results : LISTINGS;
    return { bounds: boxAround(shown, 0.5), maxZoom: 9 };
  }, [regionCities, city, regionData, country, results]);

  function pickCountry(value: Country | "") {
    setCountry(value);
    setRegion("");
    setCity("");
  }

  function pickRegion(value: string) {
    setRegion(value);
    setCity("");
  }

  const placeLabel = (l: Listing) => `${l.place}, ${t.countries[l.country]}`;

  function renderCard(l: Listing) {
    const isSaved = saved.includes(l.id);
    return (
      <li
        key={l.id}
        className={styles.card}
        data-active={activeId === l.id}
        onMouseEnter={() => setActiveId(l.id)}
        onMouseLeave={() => setActiveId(null)}
      >
        <div className={styles.cardPhoto}>
          <img src={unsplash(l.photo, 720, 420, l.photoCrop)} alt="" loading="lazy" width={720} height={420} />
          <span className={styles.badge}>{t.badges[l.badge]}</span>
          <button
            type="button"
            className={styles.save}
            aria-pressed={isSaved}
            aria-label={`${isSaved ? t.card.saved : t.card.save}: ${l.name[lang]}`}
            onClick={() => toggleSaved(l.id)}
          >
            <Heart className={styles.icon22} filled={isSaved} />
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>{l.name[lang]}</h3>
            {l.rating ? (
              <span className={styles.rating}>
                <Star className={styles.icon16} />
                {l.rating.toLocaleString(t.locale, { minimumFractionDigits: 1 })}
              </span>
            ) : (
              <span className={styles.newTag}>{t.card.isNew}</span>
            )}
          </div>
          <p className={styles.cardPlace}>{placeLabel(l)}</p>
          <p className={styles.cardFacts}>
            <span>
              <People className={styles.icon16} />
              {t.card.guests(l.guests)}
            </span>
            <span>
              <Bed className={styles.icon16} />
              {t.card.bedrooms(l.bedrooms)}
            </span>
          </p>
          <p className={styles.cardPrice}>
            <strong>{money.format(l.price)}</strong> {t.card.night}
          </p>
          <ChannelIcons ids={l.channels} label={t.card.bookOn} more={t.card.moreSites} />
        </div>
      </li>
    );
  }
  const f = t.filters;


  return (
    <div className={styles.page}>
      <section className={styles.hero} style={{ "--hero": `url(${HERO_PHOTO})` } as React.CSSProperties}>
        <header className={styles.topbar}>
          <a className={styles.brand} href={lang === "fi" ? "/" : "/en"}>
            <Logo className={styles.logo} />
            <span>Stugora</span>
          </a>
          <nav className={styles.mainNav} aria-label="Stugora">
            {t.nav.map((item, i) =>
              i === 0 ? (
                <a key={item} href="#majoitus" aria-current="page">
                  {item}
                </a>
              ) : (
                <span key={item} className={styles.navSoon} title={t.comingSoon}>
                  {item}
                </span>
              ),
            )}
          </nav>
          <div className={styles.userPill}>
            <a className={styles.langButton} href={t.langOther.href} hrefLang={lang === "fi" ? "en" : "fi"}>
              <Globe className={styles.icon18} />
              {t.langLabel}
              <Chevron className={styles.icon14} />
            </a>
            <span className={styles.pillDivider} aria-hidden="true" />
            <a className={styles.hostLink} href={t.becomeHost.href}>
              {t.becomeHost.label}
            </a>
            <button
              type="button"
              className={styles.iconButton}
              aria-pressed={savedOnly}
              aria-label={`${t.saved} (${saved.length})`}
              onClick={() => {
                setSavedOnly((v) => !v);
                resultsRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Heart className={styles.icon20} filled={savedOnly} />
              {saved.length ? <span className={styles.count}>{saved.length}</span> : null}
            </button>
            <div className={styles.menuWrap} data-menu>
              <button
                type="button"
                className={styles.avatar}
                aria-label={t.menu.label}
                aria-expanded={menu === "account"}
                onClick={() => setMenu(menu === "account" ? null : "account")}
              >
                <UserIcon className={styles.icon22} />
              </button>
              {menu === "account" ? (
                <div className={`${styles.popover} ${styles.popoverRight}`} role="menu">
                  <a role="menuitem" href={t.becomeHost.href}>
                    {t.menu.owners}
                  </a>
                  <button role="menuitem" type="button" onClick={() => { setSavedOnly(true); setMenu(null); resultsRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
                    {t.menu.saved}
                  </button>
                  <button role="menuitem" type="button" onClick={clearAll}>
                    {t.menu.all}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>{t.hero.title}</h1>
          <p className={styles.heroLead}>{t.hero.lead}</p>

          <form
            className={styles.searchBar}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              resultsRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <label className={`${styles.searchField} ${styles.searchCell}`}>
              <Pin className={styles.icon22} />
              <span className={styles.searchText}>
                <span className={styles.searchLabel}>{t.search.where}</span>
                <input
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  placeholder={t.search.wherePlaceholder}
                  list="destinations"
                  autoComplete="off"
                />
                <datalist id="destinations">
                  {[...COUNTRIES.map((c) => t.countries[c]), ...SUGGESTED].map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </span>
            </label>
            <div className={styles.searchCell} data-menu>
              <button
                type="button"
                className={styles.searchField}
                aria-expanded={menu === "dates"}
                onClick={openDates}
              >
                <CalendarIcon className={styles.icon22} />
                <span className={styles.searchText}>
                  <span className={styles.searchLabel}>{t.search.dates}</span>
                  <span className={styles.searchValue} data-empty={!datesText}>
                    {datesText || t.datePicker.addDates}
                  </span>
                </span>
              </button>
              {menu === "dates" && today ? (
                <div className={`${styles.searchPopover} ${styles.searchPopoverDates}`}>
                  <DatePanel lang={lang} value={dates} today={today} onChange={setDates} onDone={() => setMenu(null)} />
                </div>
              ) : null}
            </div>
            <div className={styles.searchCell} data-menu>
              <button
                type="button"
                className={styles.searchField}
                aria-expanded={menu === "guests"}
                onClick={() => setMenu(menu === "guests" ? null : "guests")}
              >
                <People className={styles.icon22} />
                <span className={styles.searchText}>
                  <span className={styles.searchLabel}>{t.search.guests}</span>
                  <span className={styles.searchValue} data-empty={!guestsText}>
                    {guestsText || t.search.guestsPlaceholder}
                  </span>
                </span>
              </button>
              {menu === "guests" ? (
                <div className={`${styles.searchPopover} ${styles.searchPopoverRight}`}>
                  <GuestPanel
                    lang={lang}
                    value={party}
                    onApply={(g) => {
                      setParty(g);
                      setMenu(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
            <button type="submit" className={styles.searchButton}>
              <SearchIcon className={styles.icon20} />
              {t.search.button}
            </button>
          </form>
        </div>
      </section>

      <nav className={styles.categories} aria-label={f.filters} id="majoitus">
        <div className={styles.categoriesInner}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.category}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              <CategoryIcon category={c} className={styles.categoryIcon} />
              <span>{t.categories[c]}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className={styles.listingArea} ref={resultsRef}>
        <div className={styles.filterBar}>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={styles.chip}
              data-active={advancedCount > 0}
              aria-haspopup="dialog"
              onClick={() => setFiltersOpen(true)}
            >
              <Sliders className={styles.icon18} />
              {f.filters}
              {advancedCount ? <span className={styles.chipCount}>{advancedCount}</span> : null}
            </button>

            <span className={styles.selectChip} data-active={!!country}>
              <select aria-label={f.location} value={country} onChange={(e) => pickCountry(e.target.value as Country | "")}>
                <option value="">{f.location}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {t.countries[c]}
                  </option>
                ))}
              </select>
              <Chevron className={styles.icon16} />
            </span>
            {country ? (
              <span className={styles.selectChip} data-active={!!region}>
                <select aria-label={f.region} value={region} onChange={(e) => pickRegion(e.target.value)}>
                  <option value="">{f.region}</option>
                  {[...regions]
                    .sort((a, b) => regionName(a).localeCompare(regionName(b), t.locale))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {regionName(r)}
                      </option>
                    ))}
                </select>
                <Chevron className={styles.icon16} />
              </span>
            ) : null}
            {region ? (
              <span className={styles.selectChip} data-active={!!city}>
                <select aria-label={f.city} value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">{f.city}</option>
                  {[...regionCities]
                    .sort((a, b) => a.name.localeCompare(b.name, t.locale))
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <Chevron className={styles.icon16} />
              </span>
            ) : null}
            <span className={styles.selectChip} data-active={!!maxPrice}>
              <select aria-label={f.price} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
                <option value={0}>{f.price}</option>
                <option value={150}>{f.prices[150]}</option>
                <option value={180}>{f.prices[180]}</option>
                <option value={200}>{f.prices[200]}</option>
              </select>
              <Chevron className={styles.icon16} />
            </span>
            <div className={styles.menuWrap} data-menu>
              <button
                type="button"
                className={styles.chip}
                data-active={guests > 0}
                aria-expanded={menu === "guestsBar"}
                onClick={() => setMenu(menu === "guestsBar" ? null : "guestsBar")}
              >
                <People className={styles.icon18} />
                {guestsText || f.guests}
                <Chevron className={styles.icon16} />
              </button>
              {menu === "guestsBar" ? (
                <div className={styles.popoverBare}>
                  <GuestPanel
                    lang={lang}
                    value={party}
                    onApply={(g) => {
                      setParty(g);
                      setMenu(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
            <label className={styles.toggleChip}>
              {f.instantBook}
              <input
                type="checkbox"
                role="switch"
                checked={filters.features.includes("instantBook")}
                onChange={(e) => toggleFeature("instantBook", e.target.checked)}
              />
              <span className={styles.switch} aria-hidden="true" />
            </label>
            <label className={styles.toggleChip}>
              {f.freeCancellation}
              <input
                type="checkbox"
                role="switch"
                checked={filters.features.includes("freeCancellation")}
                onChange={(e) => toggleFeature("freeCancellation", e.target.checked)}
              />
              <span className={styles.switch} aria-hidden="true" />
            </label>
          </div>

          <div className={styles.filterEnd}>
          <button
            type="button"
            className={styles.viewToggle}
            aria-pressed={view === "map"}
            onClick={() => setView(view === "map" ? "list" : "map")}
          >
            {view === "map" ? <ListIcon className={styles.icon18} /> : <MapIcon className={styles.icon18} />}
            {view === "map" ? t.view.showList : t.view.showMap}
          </button>
          <label className={styles.sort}>
            {f.sortBy}:
            <span className={styles.sortSelect}>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {(Object.keys(f.sorts) as Sort[]).map((s) => (
                  <option key={s} value={s}>
                    {f.sorts[s]}
                  </option>
                ))}
              </select>
              <Chevron className={styles.icon16} />
            </span>
          </label>
          </div>
        </div>

        <p className={styles.resultCount} aria-live="polite">
          {t.results(results.length)}
        </p>

        <div className={view === "map" ? styles.mapLayout : undefined}>
          <div className={styles.resultsColumn}>
            {results.length ? (
              <ul className={view === "map" ? styles.gridWithMap : styles.grid}>{results.map(renderCard)}</ul>
            ) : (
              <div className={styles.empty}>
                <p>{t.empty.title}</p>
                <button type="button" className={styles.clearButton} onClick={clearAll}>
                  {t.empty.action}
                </button>
              </div>
            )}
          </div>
          {view === "map" ? (
            <div className={styles.mapPanel}>
              <CottageMap
                listings={results}
                focus={focus}
                cities={regionCities}
                selectedCity={city}
                activeId={activeId}
                lang={lang}
                label={t.view.map}
                placeLabel={placeLabel}
                price={(n) => money.format(n)}
                nightLabel={t.card.night}
                onHover={setActiveId}
                onCity={(name) => setCity(name === city ? "" : name)}
              />
            </div>
          ) : null}
        </div>
        <p className={styles.examples}>{t.examples}</p>

        <section className={styles.hostBand}>
          <div>
            <h2>{t.hostBand.title}</h2>
            <p>{t.hostBand.body}</p>
          </div>
          <a className={styles.hostCta} href={t.becomeHost.href}>
            {t.hostBand.cta}
          </a>
        </section>
      </div>

      {filtersOpen ? (
        <FiltersModal
          lang={lang}
          value={filters}
          resultCount={results.length}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}

      <footer className={styles.footer}>
        <p>{t.footer.note}</p>
        <p>
          {t.footer.contact}: <span className={styles.selectable}>{CONTACT_EMAIL}</span>
        </p>
      </footer>
    </div>
  );
}
