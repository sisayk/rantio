"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Messages } from "@/i18n";
import { fill, number, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { type Currency, convert } from "@/lib/currency";
import { useMoney } from "@/lib/useMoney";
import { ownerApi } from "@/lib/ownerApi";
import { forgetOwnerSession, useOwnerSession } from "@/lib/useOwnerSession";
import CurrencyButton from "../CurrencyButton";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { cityNames, countryNamesAll, regionLabel } from "@/lib/placeNames";
import LanguageButton, { LanguageDialog, type LanguageNames } from "../LanguagePicker";
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
  listingCurrency,
  listingName,
  listingPhotos,
} from "@/lib/listings";
import { type City, PLACES } from "@/lib/places";
import ChannelIcons from "./ChannelIcons";
import type { MapFocus } from "./CottageMap";
import CardPhotos from "./CardPhotos";
import HeroSlides from "./HeroSlides";
import MainNav from "./MainNav";
import FiltersModal, { countFilters, EMPTY_FILTERS, type FilterState } from "./FiltersModal";
import { DatePanel, GuestPanel, type Guests, PricePanel, type PriceRange, priceLabel } from "./Pickers";
import {
  Bed,
  CalendarIcon,
  CategoryIcon,
  Chevron,
  Globe,
  Heart,
  ListIcon,
  MapIcon,
  People,
  Pin,
  SearchIcon,
  Sliders,
  Star,
  UserIcon,
  Wordmark,
} from "./icons";
import styles from "./guest.module.css";
import AppBadges from "../AppBadges";

// Leaflet needs the browser, so the map loads on the client only.
const CottageMap = dynamic(() => import("./CottageMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} />,
});

type Sort = "recommended" | "priceLow" | "priceHigh" | "guests";
type Menu = null | "dates" | "guests" | "guestsBar" | "price" | "account";

// Which filter section each option belongs to, and whether a cottage needs one or all of them.
const GROUP_OF = new Map<FeatureKey, { id: string; match: "any" | "all" }>(
  FEATURE_GROUPS.flatMap((g) =>
    g.options.map((k) => [k as FeatureKey, { id: g.id, match: g.match }] as const),
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

// The search box matches a cottage by any name of its town or country, in any of our languages.
const PLACE_WORDS = new Map(
  LISTINGS.map((l) => [l.id, [...cityNames(l.city), ...countryNamesAll(l.country)].join(" ")]),
);

// Search, dates, guests and filters live in the address, so the page can be shared,
// reloaded or opened in another language without losing them.
type UrlState = {
  where: string;
  from?: string;
  to?: string;
  adults: number;
  children: number;
  category: Category;
  country: Country | "";
  region: string;
  city: string;
  price: PriceRange; // in euros
  sort: Sort;
  view: "list" | "map";
  filters: FilterState;
  savedOnly: boolean;
};

const inPriceRange = (p: number, r: PriceRange) => (!r.min || p >= r.min) && (!r.max || p <= r.max);

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const eurAmount = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

function readUrl(search: string): Partial<UrlState> {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const n = Number(q.get(k));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const country = q.get("country") ?? "";
  const category = q.get("cat") ?? "all";
  const sort = q.get("sort") ?? "recommended";
  const features = (q.get("f") ?? "").split(",").filter((k) => GROUP_OF.has(k as FeatureKey)) as FeatureKey[];
  return {
    where: q.get("q") ?? "",
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    adults: num("adults"),
    children: num("children"),
    category: (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : "all",
    country: (COUNTRIES as readonly string[]).includes(country) ? (country as Country) : "",
    region: q.get("region") ?? "",
    city: q.get("city") ?? "",
    // pmin/pmax in euros, so a link means the same in every currency; "price" is the old
    // "up to" link and still works as a maximum.
    price: { min: eurAmount(q.get("pmin")), max: eurAmount(q.get("pmax")) || num("price") },
    sort: ["recommended", "priceLow", "priceHigh", "guests"].includes(sort) ? (sort as Sort) : "recommended",
    view: q.get("view") === "map" ? "map" : "list",
    filters: {
      features,
      bedrooms: (q.get("br") ?? "").split(",").map(Number).filter((n) => n >= 1 && n <= 4),
      rating4: q.get("r4") === "1",
    },
    savedOnly: q.get("saved") === "1",
  };
}

function writeUrl(s: UrlState) {
  const q = new URLSearchParams();
  const set = (k: string, v: string | number | boolean | undefined) => {
    if (v && v !== "all" && v !== "recommended" && v !== "list") q.set(k, String(v === true ? 1 : v));
  };
  set("q", s.where.trim());
  set("from", s.from);
  set("to", s.to);
  set("adults", s.adults);
  set("children", s.children);
  set("cat", s.category);
  set("country", s.country);
  set("region", s.region);
  set("city", s.city);
  set("pmin", s.price.min);
  set("pmax", s.price.max);
  set("sort", s.sort);
  set("view", s.view);
  set("f", s.filters.features.join(","));
  set("br", s.filters.bedrooms.join(","));
  set("r4", s.filters.rating4);
  set("saved", s.savedOnly);
  const next = q.toString();
  if (next !== window.location.search.slice(1)) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
  }
}

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

type Props = {
  lang: Lang;
  t: Messages["guest"];
  catalog: Messages["catalog"];
  names: Record<string, string>;
  common: Messages["common"];
  /** Country names in the page's language, worked out on the server so the browser's
   *  own locale data (which can differ) never changes them after the page loads. */
  countries: Record<Country, string>;
  languages: LanguageNames;
  currencies: Record<Currency, string>;
};

export default function GuestHome({ lang, t, catalog, names, common, countries, languages, currencies }: Props) {
  const intl = LANG_INFO[lang].intl;
  const money = useMoney(lang);
  /** What a cottage costs a night in the visitor's currency, as shown on its card. */
  const { toViewer, fromEur } = money;
  const shownPrice = useCallback((l: Listing) => toViewer(l.price, listingCurrency(l)), [toViewer]);
  const priceText = (l: Listing) => {
    const p = money.show(l.price, listingCurrency(l));
    return p.converted ? fill(lang, t.currency.about, { price: p.text }) : p.text;
  };
  const u = t.units;
  const [langOpen, setLangOpen] = useState(false);
  const owner = useOwnerSession();
  async function signOut() {
    await ownerApi.logout().catch(() => undefined);
    forgetOwnerSession();
    window.location.reload();
  }

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
  const [price, setPrice] = useState<PriceRange>({ min: 0, max: 0 });
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [savedOnly, setSavedOnly] = useState(false);
  const savedRaw = useSyncExternalStore(savedStore.subscribe, savedStore.read, () => "[]");
  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw]);
  const [menu, setMenu] = useState<Menu>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [urlRead, setUrlRead] = useState(false);

  // Once, after the first render: take the search from the address (shared link,
  // reload or a switch of language). Reading it any earlier would not match the
  // server-rendered page.
  useEffect(() => {
    const s = readUrl(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the address */
    if (s.where) setWhere(s.where);
    const from = parseDay(s.from ?? null);
    if (from) setDates({ from, to: parseDay(s.to ?? null) });
    if (s.adults || s.children) setParty({ adults: Math.max(1, s.adults ?? 0), children: s.children ?? 0 });
    if (s.category) setCategory(s.category);
    if (s.country) {
      setCountry(s.country);
      if (s.region && PLACES[s.country].some((r) => r.id === s.region)) {
        setRegion(s.region);
        if (s.city) setCity(s.city);
      }
    }
    if (s.price && (s.price.min || s.price.max)) setPrice(s.price);
    if (s.sort) setSort(s.sort);
    if (s.view) setView(s.view);
    if (s.filters) setFilters(s.filters);
    if (s.savedOnly) setSavedOnly(true);
    setUrlRead(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!urlRead) return;
    writeUrl({
      where,
      from: dates?.from ? isoDay(dates.from) : undefined,
      to: dates?.to ? isoDay(dates.to) : undefined,
      adults: party.adults,
      children: party.children,
      category,
      country,
      region,
      city,
      price,
      sort,
      view,
      filters,
      savedOnly,
    });
  }, [urlRead, where, dates, party, category, country, region, city, price, sort, view, filters, savedOnly]);

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

  const dayFormat = useMemo(() => new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" }), [intl]);
  const datesText = dates?.from
    ? `${dayFormat.format(dates.from)}${dates.to ? ` – ${dayFormat.format(dates.to)}` : ""}`
    : "";
  const guestsText = !guests
    ? ""
    : party.children
      ? fill(lang, u.guestsWithChildren, {
          guests: plural(lang, u.guests, guests),
          children: plural(lang, u.children, party.children),
        })
      : plural(lang, u.guests, guests);

  function clearAll() {
    setWhere("");
    setDates(undefined);
    setParty({ adults: 0, children: 0 });
    setCategory("all");
    setCountry("");
    setRegion("");
    setCity("");
    setPrice({ min: 0, max: 0 });
    setFilters(EMPTY_FILTERS);
    setSavedOnly(false);
    setMenu(null);
  }

  // Everything but the price, so the price panel can show what each range would leave.
  const beforePrice = useMemo(() => {
    const q = normalise(where.trim());
    return LISTINGS.filter((l) => {
      const haystack = `${l.place} ${listingName(names, l)} ${PLACE_WORDS.get(l.id) ?? ""} ${REGION_NAMES.get(l.region) ?? ""}`;
      if (q && !normalise(haystack).includes(q)) return false;
      if (category !== "all" && !l.categories.includes(category)) return false;
      if (country && l.country !== country) return false;
      if (region && l.region !== region) return false;
      if (city && l.city !== city) return false;
      if (guests && l.guests < guests) return false;
      if (!matchesFilters(l.features, l.bedrooms, l.rating, filters)) return false;
      if (savedOnly && !saved.includes(l.id)) return false;
      return true;
    });
  }, [where, names, category, country, region, city, guests, filters, savedOnly, saved]);

  // The price filter is kept in euros and shown in the visitor's currency.
  const viewerRange = useMemo<PriceRange>(
    () => ({ min: price.min ? Math.round(fromEur(price.min)) : 0, max: price.max ? Math.round(fromEur(price.max)) : 0 }),
    [price, fromEur],
  );
  const results = useMemo(() => {
    const list = beforePrice.filter((l) => inPriceRange(shownPrice(l), viewerRange));
    const eur = (l: Listing) => convert(l.price, listingCurrency(l), "EUR", money.rates);
    if (sort === "priceLow") list.sort((a, b) => eur(a) - eur(b));
    if (sort === "priceHigh") list.sort((a, b) => eur(b) - eur(a));
    if (sort === "guests") list.sort((a, b) => b.guests - a.guests);
    return list;
  }, [beforePrice, viewerRange, shownPrice, sort, money.rates]);

  const advancedCount = countFilters(filters);

  const regions = country ? PLACES[country] : [];
  const regionData = useMemo(
    () => (country ? PLACES[country].find((r) => r.id === region) : undefined),
    [country, region],
  );
  const regionCities = useMemo<City[]>(() => regionData?.cities ?? [], [regionData]);
  const regionName = (r: (typeof regions)[number]) => regionLabel(r, country, lang);

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

  const placeLabel = (l: Listing) => `${l.place}, ${countries[l.country]}`;

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
          <CardPhotos
            photos={listingPhotos(l)}
            href={paths.cottage(lang, l.id)}
            name={listingName(names, l)}
            labels={{ prev: t.photos.prev, next: t.photos.next }}
          />
          <span className={styles.badge}>{t.badges[l.badge]}</span>
          <button
            type="button"
            className={styles.save}
            aria-pressed={isSaved}
            aria-label={`${isSaved ? t.card.saved : t.card.save}: ${listingName(names, l)}`}
            onClick={() => toggleSaved(l.id)}
          >
            <Heart className={styles.icon22} filled={isSaved} />
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>
              <a className={styles.cardLink} href={paths.cottage(lang, l.id)}>
                {listingName(names, l)}
              </a>
            </h3>
            {l.rating ? (
              <span className={styles.rating}>
                <Star className={styles.icon16} />
                {number(lang, l.rating, { min: 1, max: 1 })}
              </span>
            ) : (
              <span className={styles.newTag}>{t.card.isNew}</span>
            )}
          </div>
          <p className={styles.cardPlace}>{placeLabel(l)}</p>
          <p className={styles.cardFacts}>
            <span>
              <People className={styles.icon16} />
              {plural(lang, u.guests, l.guests)}
            </span>
            <span>
              <Bed className={styles.icon16} />
              {plural(lang, u.bedrooms, l.bedrooms)}
            </span>
          </p>
          <p className={styles.cardPrice}>
            <strong title={money.show(l.price, listingCurrency(l)).converted ? money.format(l.price, listingCurrency(l)) : undefined}>
              {priceText(l)}
            </strong>{" "}
            {t.card.night}
          </p>
          <ChannelIcons ids={l.channels} label={t.card.bookOn} more={(n) => `+${n}`} />
        </div>
      </li>
    );
  }
  const f = t.filters;


  return (
    <div className={styles.page}>
      <section className={styles.hero} style={{ "--hero": `url(${HERO_PHOTO})` } as React.CSSProperties}>
        <HeroSlides lang={lang} t={t.slides} />
        <header className={styles.topbar}>
          <a className={styles.brand} href={paths.home(lang)}>
            <Wordmark />
          </a>
          <MainNav lang={lang} labels={t.nav} active="stays" staysHref="#majoitus" className={styles.mainNav} />
          <div className={styles.userPill}>
            <LanguageButton lang={lang} t={common.language} names={languages} className={styles.langButton} />
            <CurrencyButton lang={lang} t={t.currency} names={currencies} className={styles.langButton} />
            <span className={styles.pillDivider} aria-hidden="true" />
            {owner ? (
              <a className={styles.hostLink} href={paths.hosting(lang)}>
                {t.menu.switchToHosting}
              </a>
            ) : (
              <a className={styles.hostLink} href={paths.hosts(lang)}>
                {t.becomeHost}
              </a>
            )}
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
                {owner ? (
                  <span className={styles.avatarInitial} aria-hidden="true">
                    {owner.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <UserIcon className={styles.icon22} />
                )}
              </button>
              {menu === "account" ? (
                <div className={`${styles.popover} ${styles.popoverRight}`} role="menu">
                  {owner ? (
                    <>
                      <p className={styles.menuWho}>{fill(lang, t.menu.signedInAs, { name: owner.name })}</p>
                      <a role="menuitem" href={paths.hosting(lang)} className={styles.menuSwitch}>
                        {t.menu.switchToHosting}
                      </a>
                      <a role="menuitem" href={paths.hostingMessages(lang)}>
                        {t.menu.hostMessages}
                      </a>
                    </>
                  ) : (
                    <>
                      <a role="menuitem" href={paths.hosts(lang)}>
                        {t.menu.owners}
                      </a>
                      <a role="menuitem" href={paths.hostingLogin(lang)}>
                        {t.menu.login}
                      </a>
                    </>
                  )}
                  <button role="menuitem" type="button" onClick={() => { setSavedOnly(true); setMenu(null); resultsRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
                    {t.menu.saved}
                  </button>
                  <button role="menuitem" type="button" onClick={clearAll}>
                    {t.menu.all}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className={styles.menuLanguage}
                    onClick={() => {
                      setMenu(null);
                      setLangOpen(true);
                    }}
                  >
                    <Globe className={styles.icon18} />
                    <span>{t.menu.language}</span>
                    <span className={styles.menuLanguageValue}>{LANG_INFO[lang].native}</span>
                  </button>
                  <CurrencyButton lang={lang} t={t.currency} names={currencies} row className={styles.menuCurrency} />
                  {owner ? (
                    <button role="menuitem" type="button" className={styles.menuSignOut} onClick={signOut}>
                      {t.menu.logout}
                    </button>
                  ) : null}
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
                  {[...COUNTRIES.map((c) => countries[c]), ...SUGGESTED].map((d) => (
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
                  <DatePanel lang={lang} t={t.datePicker} nights={u.nights} value={dates} today={today} onChange={setDates} onDone={() => setMenu(null)} />
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
                    t={t.guestPicker}
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
                    {countries[c]}
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
                    .sort((a, b) => regionName(a).localeCompare(regionName(b), intl))
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
                    .sort((a, b) => a.name.localeCompare(b.name, intl))
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <Chevron className={styles.icon16} />
              </span>
            ) : null}
            <div className={styles.menuWrap} data-menu>
              <button
                type="button"
                className={styles.chip}
                data-active={!!(price.min || price.max)}
                aria-expanded={menu === "price"}
                onClick={() => setMenu(menu === "price" ? null : "price")}
              >
                {priceLabel(lang, f, viewerRange, money.currency)}
                <Chevron className={styles.icon16} />
              </button>
              {menu === "price" ? (
                <div className={styles.popoverBare}>
                  <PricePanel
                    lang={lang}
                    t={f}
                    clear={t.guestPicker.clear}
                    use={(n) => fill(lang, t.filterPanel.show, { cottages: plural(lang, u.cottages, n) })}
                    currency={money.currency}
                    floor={money.fromEur(1000)}
                    prices={beforePrice.map(shownPrice)}
                    value={viewerRange}
                    count={(r) => beforePrice.filter((l) => inPriceRange(shownPrice(l), r)).length}
                    onApply={(r) => {
                      const eur = (n: number) => (n ? Math.round(money.toEur(n, money.currency) * 100) / 100 : 0);
                      setPrice({ min: eur(r.min), max: eur(r.max) });
                      setMenu(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
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
                    t={t.guestPicker}
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
          {plural(lang, u.cottages, results.length)}
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
                names={names}
                label={t.view.map}
                placeLabel={placeLabel}
                price={priceText}
                pinPrice={(l) => {
                  const p = money.show(l.price, listingCurrency(l));
                  return p.converted ? `≈${"\u00a0"}${p.text}` : p.text;
                }}
                nightLabel={t.card.night}
                onHover={setActiveId}
                onCity={(name) => setCity(name === city ? "" : name)}
              />
            </div>
          ) : null}
        </div>
        <p className={styles.examples}>
          {t.examples} {t.currency.note}
        </p>

        <section className={styles.hostBand}>
          <div>
            <h2>{t.hostBand.title}</h2>
            <p>{t.hostBand.body}</p>
          </div>
          <a className={styles.hostCta} href={paths.hosts(lang)}>
            {t.hostBand.cta}
          </a>
        </section>
      </div>

      {filtersOpen ? (
        <FiltersModal
          lang={lang}
          t={t.filterPanel}
          catalog={catalog}
          cottages={u.cottages}
          value={filters}
          resultCount={results.length}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}

      <footer className={styles.footer}>
        <AppBadges t={common.apps} />
        <p>{common.footer.note}</p>
        <p className={styles.footerLinks}>
          <span>
            {common.footer.contact}: <span className={styles.selectable}>{CONTACT_EMAIL}</span>
          </span>
          <a href={paths.privacy(lang)}>{common.footer.privacy}</a>
          <a href={paths.terms(lang)}>{common.footer.terms}</a>
          <a href="https://db-ip.com" rel="noopener">IP Geolocation by DB-IP</a>
        </p>
      </footer>

      {langOpen ? <LanguageDialog lang={lang} t={common.language} names={languages} onClose={() => setLangOpen(false)} /> : null}
    </div>
  );
}
