"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CONTACT_EMAIL, type Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import { AMENITIES, type Amenity, CATEGORIES, type Category, HERO_PHOTO, LISTINGS, unsplash } from "@/lib/listings";
import {
  Bed,
  CalendarIcon,
  CategoryIcon,
  Chevron,
  Globe,
  Heart,
  Logo,
  People,
  Pin,
  SearchIcon,
  Sliders,
  Star,
  UserIcon,
} from "./icons";
import styles from "./guest.module.css";

type Sort = "recommended" | "priceLow" | "priceHigh" | "guests";
type Region = "" | "saimaa" | "lakeland" | "lapland";
type Menu = null | "filters" | "amenities" | "account";

const DESTINATIONS = ["Saimaa", "Savonlinna", "Puumala", "Mikkeli", "Päijänne", "Jämsä", "Lappi", "Levi", "Ylläs", "Rovaniemi"];
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
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(0);
  const [category, setCategory] = useState<Category>("all");
  const [region, setRegion] = useState<Region>("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [bedrooms, setBedrooms] = useState(0);
  const [instantBook, setInstantBook] = useState(false);
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
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

  function toggleAmenity(a: Amenity) {
    setAmenities((current) => (current.includes(a) ? current.filter((x) => x !== a) : [...current, a]));
  }

  function clearAll() {
    setWhere("");
    setCheckIn("");
    setCheckOut("");
    setGuests(0);
    setCategory("all");
    setRegion("");
    setMaxPrice(0);
    setBedrooms(0);
    setInstantBook(false);
    setFreeCancellation(false);
    setAmenities([]);
    setSavedOnly(false);
    setMenu(null);
  }

  const results = useMemo(() => {
    const q = normalise(where.trim());
    const list = LISTINGS.filter((l) => {
      if (q && !normalise(`${l.place} ${l.name.fi} ${l.name.en} ${l.region}`).includes(q)) return false;
      if (category !== "all" && !l.categories.includes(category)) return false;
      if (region && l.region !== region) return false;
      if (maxPrice && l.price > maxPrice) return false;
      if (guests && l.guests < guests) return false;
      if (bedrooms && l.bedrooms < bedrooms) return false;
      if (instantBook && !l.instantBook) return false;
      if (freeCancellation && !l.freeCancellation) return false;
      if (amenities.some((a) => !l.amenities.includes(a))) return false;
      if (savedOnly && !saved.includes(l.id)) return false;
      return true;
    });
    if (sort === "priceLow") list.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") list.sort((a, b) => b.price - a.price);
    if (sort === "guests") list.sort((a, b) => b.guests - a.guests);
    return list;
  }, [where, category, region, maxPrice, guests, bedrooms, instantBook, freeCancellation, amenities, savedOnly, saved, sort]);

  const advancedCount = [instantBook, freeCancellation].filter(Boolean).length + amenities.length;
  const f = t.filters;

  const amenityChecks = (
    <div className={styles.checkList}>
      {AMENITIES.map((a) => (
        <label key={a} className={styles.checkRow}>
          <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} />
          {f.amenityNames[a]}
        </label>
      ))}
    </div>
  );

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
            <label className={styles.searchField}>
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
                  {DESTINATIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </span>
            </label>
            <div className={styles.searchField}>
              <CalendarIcon className={styles.icon22} />
              <span className={styles.searchText}>
                <span className={styles.searchLabel}>{t.search.dates}</span>
                <span className={styles.dateRow}>
                  <input
                    type="date"
                    aria-label={t.search.checkIn}
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut && e.target.value >= checkOut) setCheckOut("");
                    }}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="date"
                    aria-label={t.search.checkOut}
                    min={checkIn || undefined}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </span>
              </span>
            </div>
            <label className={styles.searchField}>
              <People className={styles.icon22} />
              <span className={styles.searchText}>
                <span className={styles.searchLabel}>{t.search.guests}</span>
                <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                  <option value={0}>{t.search.guestsPlaceholder}</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {t.search.guestsValue(n)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
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
            <div className={styles.menuWrap} data-menu>
              <button
                type="button"
                className={styles.chip}
                data-active={advancedCount > 0}
                aria-expanded={menu === "filters"}
                onClick={() => setMenu(menu === "filters" ? null : "filters")}
              >
                <Sliders className={styles.icon18} />
                {f.filters}
                {advancedCount ? <span className={styles.chipCount}>{advancedCount}</span> : null}
              </button>
              {menu === "filters" ? (
                <div className={styles.popover}>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={instantBook} onChange={(e) => setInstantBook(e.target.checked)} />
                    {f.instantBook}
                  </label>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={freeCancellation} onChange={(e) => setFreeCancellation(e.target.checked)} />
                    {f.freeCancellation}
                  </label>
                  <p className={styles.popoverHeading}>{f.amenities}</p>
                  {amenityChecks}
                  <button type="button" className={styles.clearButton} onClick={clearAll}>
                    {f.clear}
                  </button>
                </div>
              ) : null}
            </div>

            <span className={styles.selectChip} data-active={!!region}>
              <select aria-label={f.location} value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                <option value="">{f.location}</option>
                <option value="saimaa">{f.locations.saimaa}</option>
                <option value="lakeland">{f.locations.lakeland}</option>
                <option value="lapland">{f.locations.lapland}</option>
              </select>
              <Chevron className={styles.icon16} />
            </span>
            <span className={styles.selectChip} data-active={!!maxPrice}>
              <select aria-label={f.price} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
                <option value={0}>{f.price}</option>
                <option value={150}>{f.prices[150]}</option>
                <option value={180}>{f.prices[180]}</option>
                <option value={200}>{f.prices[200]}</option>
              </select>
              <Chevron className={styles.icon16} />
            </span>
            <span className={styles.selectChip} data-active={!!guests}>
              <select aria-label={f.guests} value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                <option value={0}>{f.guests}</option>
                {[2, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {t.search.guestsValue(n)}+
                  </option>
                ))}
              </select>
              <Chevron className={styles.icon16} />
            </span>
            <span className={styles.selectChip} data-active={!!bedrooms}>
              <select aria-label={f.bedrooms} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))}>
                <option value={0}>{f.bedrooms}</option>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {f.bedroomsMin(n)}
                  </option>
                ))}
              </select>
              <Chevron className={styles.icon16} />
            </span>
            <label className={styles.toggleChip}>
              {f.instantBook}
              <input type="checkbox" role="switch" checked={instantBook} onChange={(e) => setInstantBook(e.target.checked)} />
              <span className={styles.switch} aria-hidden="true" />
            </label>
            <label className={styles.toggleChip}>
              {f.freeCancellation}
              <input type="checkbox" role="switch" checked={freeCancellation} onChange={(e) => setFreeCancellation(e.target.checked)} />
              <span className={styles.switch} aria-hidden="true" />
            </label>
            <div className={styles.menuWrap} data-menu>
              <button
                type="button"
                className={styles.chip}
                data-active={amenities.length > 0}
                aria-expanded={menu === "amenities"}
                onClick={() => setMenu(menu === "amenities" ? null : "amenities")}
              >
                {f.amenities}
                {amenities.length ? <span className={styles.chipCount}>{amenities.length}</span> : null}
                <Chevron className={styles.icon16} />
              </button>
              {menu === "amenities" ? <div className={styles.popover}>{amenityChecks}</div> : null}
            </div>
          </div>

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

        <p className={styles.resultCount} aria-live="polite">
          {t.results(results.length)}
        </p>

        {results.length ? (
          <ul className={styles.grid}>
            {results.map((l) => {
              const isSaved = saved.includes(l.id);
              return (
                <li key={l.id} className={styles.card}>
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
                    <p className={styles.cardPlace}>{l.place}</p>
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
                    <p className={styles.channels} aria-label={`${t.card.bookOn}: ${l.channels.join(", ")}`}>
                      {l.channels.map((c) => (
                        <span key={c} className={styles.channel}>
                          {c}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p>{t.empty.title}</p>
            <button type="button" className={styles.clearButton} onClick={clearAll}>
              {t.empty.action}
            </button>
          </div>
        )}
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

      <footer className={styles.footer}>
        <p>{t.footer.note}</p>
        <p>
          {t.footer.contact}: <span className={styles.selectable}>{CONTACT_EMAIL}</span>
        </p>
      </footer>
    </div>
  );
}
