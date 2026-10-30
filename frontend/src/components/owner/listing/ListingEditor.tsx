"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { AMENITY_GROUPS, amenityName } from "@/lib/amenities";
import { formatPrice, isCurrency } from "@/lib/currency";
import {
  type ListingDetail,
  type ListingFields,
  type ListingPhoto,
  type Nearby,
  type NearbyKind,
  ownerApi,
  type PropertyType,
  SignedOut,
  type StatusAction,
} from "@/lib/ownerApi";
import { PLACES } from "@/lib/places";
import HostingHeader from "../HostingHeader";
import SiteIcon from "../SiteIcon";
import o from "../owner.module.css";
import PhotoManager from "./PhotoManager";
import { actionsFor, CHECK_SECTION, checklist, dateFormats, LANG_CODES, type Section, SECTIONS } from "./shared";
import { ArrowLeft, Check, Dialog, fieldError, Trash, useToasts } from "./ui";
import s from "./editor.module.css";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false, loading: () => <div className={s.map} /> });

type L = Messages["listings"];
type Errors = Record<string, unknown>;

const FIELDS = [
  "name", "property_type", "country", "municipality", "address", "latitude", "longitude", "show_exact_location",
  "max_guests", "bedrooms", "bathrooms", "beds", "floor_area", "floors", "host_languages", "descriptions", "nearby",
  "amenities", "amenity_notes", "min_nights", "max_nights", "price_per_night", "weekend_price", "cleaning_fee",
  "extra_guest_fee", "extra_guest_from", "pet_fee", "weekly_discount", "monthly_discount", "security_deposit",
  "seasonal_prices", "taxes_note", "check_in_from", "check_in_until", "check_out_by", "self_check_in", "min_age",
  "pets_allowed", "smoking_allowed", "events_allowed", "quiet_hours", "house_rules", "waste_instructions",
  "sauna_instructions", "fireplace_instructions", "arrival_instructions", "departure_instructions", "access_details",
  "nettimokki_url",
] as const satisfies readonly (keyof ListingFields)[];

const FIELD_SECTION: Record<string, Section> = {
  amenities: "amenities", amenity_notes: "amenities",
  min_nights: "pricing", max_nights: "pricing", price_per_night: "pricing", weekend_price: "pricing", cleaning_fee: "pricing",
  extra_guest_fee: "pricing", extra_guest_from: "pricing", pet_fee: "pricing", weekly_discount: "pricing", monthly_discount: "pricing",
  security_deposit: "pricing", seasonal_prices: "pricing", taxes_note: "pricing",
  check_in_from: "rules", check_in_until: "rules", check_out_by: "rules", self_check_in: "rules", min_age: "rules",
  pets_allowed: "rules", smoking_allowed: "rules", events_allowed: "rules", quiet_hours: "rules", house_rules: "rules",
  waste_instructions: "rules", sauna_instructions: "rules", fireplace_instructions: "rules",
  arrival_instructions: "arrival", departure_instructions: "arrival", access_details: "arrival",
  latitude: "location", longitude: "location", show_exact_location: "location", nearby: "location",
  nettimokki_url: "calendar",
};

const TYPES: PropertyType[] = ["cottage", "cabin", "villa", "holiday_home", "apartment", "farmhouse", "other"];
const NEARBY: NearbyKind[] = ["lake", "beach", "ski", "hiking", "grocery", "restaurant", "transport", "evCharging", "airport", "station", "other"];
const COUNTRIES = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"];
const CENTER: Record<string, { lat: number; lng: number }> = {
  FI: { lat: 62.5, lng: 26 }, SE: { lat: 62, lng: 15.5 }, NO: { lat: 63, lng: 10.5 }, DK: { lat: 56, lng: 10 },
  IS: { lat: 64.9, lng: -18.6 }, EE: { lat: 58.7, lng: 25.5 }, LV: { lat: 56.9, lng: 24.6 }, LT: { lat: 55.3, lng: 23.9 },
};

function pick(d: ListingDetail): ListingFields {
  const out = {} as Record<string, unknown>;
  for (const k of FIELDS) out[k] = d[k];
  // Times come as "16:00"; descriptions keep every language key so an emptied one is sent as "".
  return { ...(out as ListingFields), descriptions: { ...d.descriptions }, nettimokki_url: d.nettimokki_url ?? "" };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const draftKey = (id: number) => `stugora.listing.${id}.draft`;

export default function ListingEditor({
  lang,
  t,
  l,
  features,
  countries,
  languageButton,
  id,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  l: L;
  features: Record<string, string>;
  countries: Record<string, string>;
  languageButton: React.ReactNode;
  id: number;
}) {
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [form, setForm] = useState<ListingFields | null>(null);
  const [saved, setSaved] = useState<ListingFields | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [section, setSection] = useState<Section>("overview");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [recovery, setRecovery] = useState<{ at: string; form: ListingFields } | null>(null);
  const [owner, setOwner] = useState("");
  const [descLang, setDescLang] = useState<Lang>(lang);
  const [amenityQuery, setAmenityQuery] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "pause" | "archive" | "delete">(null);
  const [deleteName, setDeleteName] = useState("");
  const [working, setWorking] = useState(false);
  const toasts = useToasts();
  const fmt = useMemo(() => dateFormats(lang), [lang]);
  const panelRef = useRef<HTMLDivElement>(null);

  const signedOut = useCallback(() => window.location.replace(paths.hostingLogin(lang)), [lang]);

  const accept = useCallback((d: ListingDetail, keepForm: boolean) => {
    const fields = pick(d);
    setDetail(d);
    setPhotos(d.photos);
    setSaved(fields);
    setForm((f) => (keepForm && f ? f : fields));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      ownerApi.me().then((me) => setOwner(me.name), () => undefined);
      const hash = window.location.hash.slice(1) as Section;
      if ((SECTIONS as readonly string[]).includes(hash)) setSection(hash);
      try {
        const d = await ownerApi.listing(id);
        accept(d, false);
        setState("ready");
        try {
          const raw = window.localStorage.getItem(draftKey(id));
          const kept = raw ? (JSON.parse(raw) as { at: string; form: ListingFields }) : null;
          if (kept && !same(kept.form, pick(d))) setRecovery(kept);
          else if (raw) window.localStorage.removeItem(draftKey(id));
        } catch {
          /* storage unavailable: nothing to restore */
        }
      } catch (err) {
        if (err instanceof SignedOut) return signedOut();
        setState((err as { status?: number }).status === 404 ? "missing" : "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, accept, signedOut]);

  const dirtyKeys = useMemo(
    () => (form && saved ? FIELDS.filter((k) => !same(form[k], saved[k])) : []),
    [form, saved],
  );
  const dirty = dirtyKeys.length > 0;

  // Unsaved edits survive a closed tab or an expired sign-in: kept on this device until saved.
  useEffect(() => {
    if (!form || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey(id), JSON.stringify({ at: new Date().toISOString(), form }));
      } catch {
        /* storage full or blocked */
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [form, dirty, id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = l.leave;
      return l.leave;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, l.leave]);

  const go = (next: Section) => {
    setSection(next);
    window.history.replaceState(window.history.state, "", `#${next}`);
    panelRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const set = <K extends keyof ListingFields>(key: K, value: ListingFields[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (errors[key])
      setErrors((e) => {
        const rest = { ...e };
        delete rest[key];
        return rest;
      });
  };

  const forget = () => {
    try {
      window.localStorage.removeItem(draftKey(id));
    } catch {
      /* nothing kept */
    }
  };

  async function save() {
    if (!form || !dirty) return;
    setSaving(true);
    const changes: Partial<ListingFields> = {};
    for (const k of dirtyKeys) (changes as Record<string, unknown>)[k] = form[k];
    try {
      const d = await ownerApi.saveListing(id, changes);
      accept(d, false);
      setErrors({});
      forget();
      toasts.push("ok", l.saved);
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      const status = (err as { status?: number }).status;
      if (status === 400) {
        setErrors((err as { body?: Errors }).body ?? {});
        toasts.push("error", l.saveError);
      } else {
        toasts.push("error", l.networkError);
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (saved) setForm(saved);
    setErrors({});
    forget();
  }

  async function changeStatus(action: StatusAction) {
    setWorking(true);
    try {
      const d = await ownerApi.setListingStatus(id, action);
      accept(d, true);
      setConfirm(null);
      const done: Record<StatusAction, string> = {
        publish: l.status.published, pause: l.status.paused, relist: l.status.relisted, archive: l.status.archived, restore: l.status.restored,
      };
      toasts.push("ok", done[action]);
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      const body = (err as { body?: { reason?: string; missing?: string[]; count?: number } }).body ?? {};
      if (body.reason === "incomplete") {
        const names = (body.missing ?? []).map((k) => l.checklist.items[k as keyof L["checklist"]["items"]] ?? k);
        toasts.push("error", fill(lang, l.status.missing, { items: names.join(", ") }));
      } else if (body.reason === "future_bookings") {
        toasts.push("error", plural(lang, l.status.futureBookings, body.count ?? 1));
      } else if (body.reason === "not_allowed") {
        toasts.push("error", l.status.notAllowed);
      } else {
        toasts.push("error", l.networkError);
      }
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setWorking(true);
    try {
      await ownerApi.deleteListing(id, deleteName.trim());
      forget();
      window.location.assign(paths.hostingListings(lang));
    } catch (err) {
      if (err instanceof SignedOut) return signedOut();
      const reason = (err as { body?: { reason?: string } }).body?.reason;
      toasts.push(
        "error",
        reason === "has_bookings" ? l.status.deleteHasBookings : reason === "has_messages" ? l.status.deleteHasMessages : reason === "confirm" ? l.status.deleteName : l.networkError,
      );
      setWorking(false);
    }
  }

  const header = <HostingHeader lang={lang} t={t} languageButton={languageButton} active="listings" ownerName={owner} />;

  if (state !== "ready" || !detail || !form) {
    return (
      <div className={o.page}>
        {header}
        <main className={o.main}>
          {state === "loading" ? (
            <div className={o.skeleton} aria-busy="true" aria-label={t.loading}>
              <span />
              <span />
            </div>
          ) : (
            <div className={o.errorBox} role="alert">
              <p>{state === "missing" ? l.notFound : t.error}</p>
              <a className={o.primary} href={paths.hostingListings(lang)}>
                {l.back}
              </a>
            </div>
          )}
        </main>
      </div>
    );
  }

  const f = form;
  const err = (k: string) => fieldError(errors, k);
  const currency = isCurrency(detail.currency) ? detail.currency : "EUR";
  const connected = detail.channels.filter((c) => c.feed_id !== null).length;
  const check = checklist(f, photos, connected);
  const todoSections = new Set(check.items.filter((i) => !i.done && i.essential).map((i) => CHECK_SECTION[i.key]));
  const status = detail.status;

  const text = (key: keyof ListingFields, label: string, opts: { placeholder?: string; hint?: string; rows?: number; max?: number } = {}) => (
    <label className={s.field}>
      <span>{label}</span>
      {opts.rows ? (
        <textarea
          className={s.textarea}
          rows={opts.rows}
          maxLength={opts.max}
          placeholder={opts.placeholder}
          value={(f[key] as string) ?? ""}
          aria-invalid={Boolean(err(key))}
          onChange={(e) => set(key, e.target.value as never)}
        />
      ) : (
        <input
          className={s.input}
          maxLength={opts.max}
          placeholder={opts.placeholder}
          value={(f[key] as string) ?? ""}
          aria-invalid={Boolean(err(key))}
          onChange={(e) => set(key, e.target.value as never)}
        />
      )}
      {opts.hint ? <span className={s.hint}>{opts.hint}</span> : null}
      {err(key) ? <span className={s.error}>{l.invalid}: {err(key)}</span> : null}
    </label>
  );

  const numberField = (key: keyof ListingFields, label: string, opts: { min?: number; max?: number; step?: string; money?: boolean; hint?: string } = {}) => (
    <label className={s.field}>
      <span>{label}</span>
      <input
        className={s.input}
        type="number"
        inputMode={opts.money ? "decimal" : "numeric"}
        min={opts.min ?? 0}
        max={opts.max}
        step={opts.step ?? (opts.money ? "0.01" : "1")}
        value={f[key] === null || f[key] === undefined ? "" : String(f[key])}
        aria-invalid={Boolean(err(key))}
        onChange={(e) => {
          const v = e.target.value;
          set(key, (v === "" ? null : opts.money ? v : Number(v)) as never);
        }}
      />
      {opts.hint ? <span className={s.hint}>{opts.hint}</span> : null}
      {err(key) ? <span className={s.error}>{l.invalid}: {err(key)}</span> : null}
    </label>
  );

  const toggle = (key: keyof ListingFields, label: string) => (
    <label className={s.check}>
      <input type="checkbox" checked={Boolean(f[key])} onChange={(e) => set(key, e.target.checked as never)} />
      <span>{label}</span>
    </label>
  );

  const timeField = (key: "check_in_from" | "check_in_until" | "check_out_by", label: string) => (
    <label className={s.field}>
      <span>{label}</span>
      <input
        className={s.input}
        type="time"
        value={f[key] ?? ""}
        aria-invalid={Boolean(err(key))}
        onChange={(e) => set(key, e.target.value || null)}
      />
    </label>
  );

  // ---------- sections ----------
  const overview = (
    <section className={s.panel} aria-labelledby="sec-overview">
      <h2 id="sec-overview">{fill(lang, l.checklist.title, { pct: check.pct })}</h2>
      <p className={s.panelLead}>{l.checklist.lead}</p>
      <div className={s.progressBar}>
        <span style={{ width: `${check.pct}%` }} />
      </div>
      <ul className={s.checklist}>
        {check.items.map((i) => (
          <li key={i.key}>
            <span className={s.tick} data-done={i.done}>
              {i.done ? <Check /> : null}
            </span>
            <span className={s.spacer}>
              {l.checklist.items[i.key]} {i.essential && !i.done ? <span className={s.need}>{l.checklist.needed}</span> : null}
            </span>
            {i.done ? (
              <span className={`${s.muted} ${s.small}`}>{l.checklist.done}</span>
            ) : (
              <button type="button" className={s.ghost} onClick={() => go(CHECK_SECTION[i.key])}>
                {l.checklist.open}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={s.info}>{l.stugoraOnly}</p>
    </section>
  );

  const basics = (
    <section className={s.panel} aria-labelledby="sec-basics">
      <h2 id="sec-basics">{l.basics.title}</h2>
      {text("name", l.basics.name, { max: 120 })}
      <div className={s.grid2}>
        <label className={s.field}>
          <span>{l.basics.type}</span>
          <select className={s.select} value={f.property_type} onChange={(e) => set("property_type", e.target.value as PropertyType)}>
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {l.types[x]}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          <span>{l.basics.country}</span>
          <select className={s.select} value={f.country} onChange={(e) => set("country", e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {countries[c] ?? c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.grid2}>
        {text("municipality", l.basics.municipality, { max: 80 })}
        {text("address", l.basics.address, { max: 200, hint: l.basics.addressHint })}
      </div>
      <div className={s.grid3}>
        {numberField("max_guests", l.basics.guests, { min: 1, max: 50 })}
        {numberField("bedrooms", l.basics.bedrooms, { max: 30 })}
        {numberField("bathrooms", l.basics.bathrooms, { max: 20 })}
        {numberField("beds", l.basics.beds, { max: 60 })}
        {numberField("floor_area", l.basics.area, { min: 1, max: 5000 })}
        {numberField("floors", l.basics.floors, { min: 1, max: 10 })}
      </div>
      <fieldset className={s.group} style={{ border: 0, margin: 0, padding: "20px 0 0", borderTop: "1px solid var(--o-line)" }}>
        <legend className={s.field} style={{ fontWeight: 600, fontSize: 14, padding: 0 }}>
          {l.basics.languages}
        </legend>
        <div className={s.chips}>
          {LANG_CODES.map((code) => {
            const on = f.host_languages.includes(code);
            return (
              <button
                key={code}
                type="button"
                className={s.chip}
                aria-pressed={on}
                onClick={() => set("host_languages", on ? f.host_languages.filter((x) => x !== code) : [...f.host_languages, code])}
              >
                {LANG_INFO[code].native}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className={s.group}>
        <h3>{l.basics.descriptions}</h3>
        <p className={s.hint}>{l.basics.descriptionsLead}</p>
        <div className={s.tabs} role="tablist" aria-label={l.basics.descriptions}>
          {LANG_CODES.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              className={s.tab}
              aria-selected={descLang === code}
              data-written={Boolean(f.descriptions[code]?.trim())}
              title={f.descriptions[code]?.trim() ? l.basics.written : undefined}
              onClick={() => setDescLang(code)}
            >
              {LANG_INFO[code].native}
            </button>
          ))}
        </div>
        <label className={s.field}>
          <span className={s.visuallyHidden}>
            {l.basics.descriptions} ({LANG_INFO[descLang].native})
          </span>
          <textarea
            className={s.textarea}
            rows={8}
            lang={descLang}
            maxLength={5000}
            placeholder={l.basics.descriptionPlaceholder}
            value={f.descriptions[descLang] ?? ""}
            aria-invalid={Boolean(err("descriptions"))}
            onChange={(e) => set("descriptions", { ...f.descriptions, [descLang]: e.target.value })}
          />
          <span className={s.hint}>{fill(lang, l.basics.chars, { n: (f.descriptions[descLang] ?? "").length, max: 5000 })}</span>
          {err("descriptions") ? <span className={s.error}>{l.invalid}</span> : null}
        </label>
      </div>
    </section>
  );

  const photosSection = (
    <section className={s.panel} aria-labelledby="sec-photos">
      <h2 id="sec-photos">{l.photos.title}</h2>
      <p className={s.panelLead}>{l.photos.lead}</p>
      <PhotoManager lang={lang} l={l} cottageId={id} photos={photos} onChange={setPhotos} notify={toasts.push} onSignedOut={signedOut} />
    </section>
  );

  const q = amenityQuery.trim().toLowerCase();
  const nameOf = (k: string) => amenityName(k, features, l.amenities.names);
  const amenities = (
    <section className={s.panel} aria-labelledby="sec-amenities">
      <h2 id="sec-amenities">{l.amenities.title}</h2>
      <p className={s.panelLead}>{l.amenities.lead}</p>
      <div className={s.row}>
        <label className={s.field} style={{ flex: "1 1 260px" }}>
          <span className={s.visuallyHidden}>{l.amenities.search}</span>
          <input className={s.input} type="search" placeholder={l.amenities.search} value={amenityQuery} onChange={(e) => setAmenityQuery(e.target.value)} />
        </label>
        <span className={s.badge}>{plural(lang, l.amenities.selected, f.amenities.filter((k) => k !== "pets").length)}</span>
      </div>
      {AMENITY_GROUPS.map((g) => {
        const keys = g.keys.filter((k) => !q || nameOf(k).toLowerCase().includes(q));
        if (!keys.length) return null;
        return (
          <div key={g.id} className={s.amenityGroup}>
            <h3>{l.amenities.groups[g.id as keyof L["amenities"]["groups"]]}</h3>
            <ul className={s.amenityGrid}>
              {keys.map((k) => {
                const on = f.amenities.includes(k);
                const note = f.amenity_notes[k];
                return (
                  <li key={k} className={s.amenityItem}>
                    <div className={s.row} style={{ flexWrap: "nowrap" }}>
                      <label className={s.check} style={{ flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => set("amenities", e.target.checked ? [...f.amenities, k] : f.amenities.filter((x) => x !== k))}
                        />
                        <span>
                          {nameOf(k)}
                          {note?.note || note?.fee ? (
                            <small className={s.muted}>
                              {" "}
                              · {[note.note, note.fee ? formatPrice(lang, Number(note.fee), currency, true) : ""].filter(Boolean).join(" · ")}
                            </small>
                          ) : null}
                        </span>
                      </label>
                      {on ? (
                        <button type="button" className={s.ghost} aria-expanded={openNote === k} onClick={() => setOpenNote(openNote === k ? null : k)}>
                          {l.amenities.details}
                        </button>
                      ) : null}
                    </div>
                    {on && openNote === k ? (
                      <div className={s.amenityMore}>
                        <label className={s.field}>
                          <span>{l.amenities.note}</span>
                          <input
                            className={s.input}
                            maxLength={200}
                            placeholder={l.amenities.notePlaceholder}
                            value={note?.note ?? ""}
                            onChange={(e) => set("amenity_notes", { ...f.amenity_notes, [k]: { note: e.target.value, fee: note?.fee ?? null } })}
                          />
                        </label>
                        <label className={s.field}>
                          <span>{fill(lang, l.amenities.fee, { currency })}</span>
                          <input
                            className={s.input}
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            placeholder={l.amenities.feeFree}
                            value={note?.fee ?? ""}
                            onChange={(e) =>
                              set("amenity_notes", { ...f.amenity_notes, [k]: { note: note?.note ?? "", fee: e.target.value === "" ? null : e.target.value } })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {q && !AMENITY_GROUPS.some((g) => g.keys.some((k) => nameOf(k).toLowerCase().includes(q))) ? (
        <p className={s.muted}>{fill(lang, l.amenities.noMatch, { query: amenityQuery })}</p>
      ) : null}
      {err("amenities") || err("amenity_notes") ? <p className={s.error}>{l.invalid}</p> : null}
    </section>
  );

  const dayPick = (value: string, onChange: (v: string) => void, label: string) => {
    const [m, d] = (value || "01-01").split("-");
    const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(LANG_INFO[lang].intl, { month: "short" }).format(new Date(2024, i, 15)));
    return (
      <div className={s.field}>
        <span>{label}</span>
        <div className={s.dayPick}>
          <select className={s.select} aria-label={`${label}: ${l.pricing.month}`} value={m} onChange={(e) => onChange(`${e.target.value}-${d}`)}>
            {months.map((name, i) => (
              <option key={name} value={String(i + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </select>
          <input
            className={s.input}
            type="number"
            min={1}
            max={31}
            aria-label={`${label}: ${l.pricing.day}`}
            value={Number(d)}
            onChange={(e) => onChange(`${m}-${String(Math.min(31, Math.max(1, Number(e.target.value) || 1))).padStart(2, "0")}`)}
          />
        </div>
      </div>
    );
  };

  const setSeason = (i: number, patch: Partial<ListingFields["seasonal_prices"][number]>) =>
    set("seasonal_prices", f.seasonal_prices.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const pricing = (
    <section className={s.panel} aria-labelledby="sec-pricing">
      <h2 id="sec-pricing">{l.pricing.title}</h2>
      <p className={s.panelLead}>{l.pricing.lead}</p>
      <div className={s.grid2}>
        {numberField("price_per_night", `${l.pricing.base} (${currency})`, { money: true })}
        {numberField("weekend_price", `${l.pricing.weekend} (${currency})`, { money: true, hint: l.pricing.weekendHint })}
      </div>
      <div className={s.group}>
        <h3>{l.pricing.stay}</h3>
        <div className={s.grid2}>
          {numberField("min_nights", l.pricing.minNights, { min: 1, max: 60 })}
          {numberField("max_nights", l.pricing.maxNights, { min: 1, max: 365 })}
        </div>
      </div>
      <div className={s.group}>
        <h3>{l.pricing.fees}</h3>
        <div className={s.grid2}>
          {numberField("cleaning_fee", `${l.pricing.cleaning} (${currency})`, { money: true })}
          {numberField("security_deposit", `${l.pricing.deposit} (${currency})`, { money: true })}
          {numberField("extra_guest_fee", `${l.pricing.extraGuest} (${currency})`, { money: true })}
          {numberField("extra_guest_from", l.pricing.extraGuestFrom, { min: 1, max: 50 })}
          {numberField("pet_fee", `${l.pricing.pet} (${currency})`, { money: true })}
        </div>
      </div>
      <div className={s.group}>
        <h3>{l.pricing.discounts}</h3>
        <div className={s.grid2}>
          {numberField("weekly_discount", l.pricing.weekly, { max: 80 })}
          {numberField("monthly_discount", l.pricing.monthly, { max: 80 })}
        </div>
      </div>
      <div className={s.group}>
        <h3>{l.pricing.seasons}</h3>
        <p className={s.hint}>{l.pricing.seasonsLead}</p>
        {f.seasonal_prices.length ? (
          <ul className={s.rows}>
            {f.seasonal_prices.map((season, i) => (
              <li key={i} className={`${s.rowItem} ${s.seasonRow}`}>
                <label className={s.field}>
                  <span>{l.pricing.seasonName}</span>
                  <input className={s.input} maxLength={60} placeholder={l.pricing.seasonNamePlaceholder} value={season.name} onChange={(e) => setSeason(i, { name: e.target.value })} />
                </label>
                {dayPick(season.start, (v) => setSeason(i, { start: v }), l.pricing.from)}
                {dayPick(season.end, (v) => setSeason(i, { end: v }), l.pricing.to)}
                <label className={s.field}>
                  <span>{`${l.pricing.seasonPrice} (${currency})`}</span>
                  <input className={s.input} type="number" min={0} step="0.01" inputMode="decimal" value={season.price} onChange={(e) => setSeason(i, { price: e.target.value })} />
                </label>
                <button type="button" className={s.iconBtn} aria-label={l.pricing.removeSeason} onClick={() => set("seasonal_prices", f.seasonal_prices.filter((_, j) => j !== i))}>
                  <Trash />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <button
            type="button"
            className={s.button}
            onClick={() => set("seasonal_prices", [...f.seasonal_prices, { name: "", start: "06-19", end: "06-26", price: f.price_per_night || "0" }])}
          >
            {l.pricing.addSeason}
          </button>
        </div>
        {err("seasonal_prices") ? <p className={s.error}>{l.invalid}: {err("seasonal_prices")}</p> : null}
      </div>
      <div className={s.group}>{text("taxes_note", l.pricing.taxes, { max: 300, placeholder: l.pricing.taxesPlaceholder })}</div>
    </section>
  );

  const rules = (
    <section className={s.panel} aria-labelledby="sec-rules">
      <h2 id="sec-rules">{l.rules.title}</h2>
      <p className={s.panelLead}>{l.rules.lead}</p>
      <div className={s.grid3}>
        {timeField("check_in_from", l.rules.checkInFrom)}
        {timeField("check_in_until", l.rules.checkInUntil)}
        {timeField("check_out_by", l.rules.checkOutBy)}
      </div>
      <div>
        {toggle("self_check_in", l.rules.selfCheckIn)}
        {toggle("pets_allowed", l.rules.pets)}
        {toggle("smoking_allowed", l.rules.smoking)}
        {toggle("events_allowed", l.rules.events)}
      </div>
      <div className={s.grid2}>
        {text("quiet_hours", l.rules.quiet, { max: 60, placeholder: l.rules.quietPlaceholder })}
        {numberField("min_age", l.rules.minAge, { min: 18, max: 30, hint: l.rules.minAgeHint })}
      </div>
      <div className={s.group}>
        {text("waste_instructions", l.rules.waste, { rows: 3, max: 2000, placeholder: l.rules.wastePlaceholder })}
        {text("sauna_instructions", l.rules.sauna, { rows: 3, max: 2000, placeholder: l.rules.saunaPlaceholder })}
        {text("fireplace_instructions", l.rules.fireplace, { rows: 3, max: 2000, placeholder: l.rules.fireplacePlaceholder })}
        {text("house_rules", l.rules.other, { rows: 4, max: 4000, placeholder: l.rules.otherPlaceholder })}
      </div>
    </section>
  );

  const arrival = (
    <section className={s.panel} aria-labelledby="sec-arrival">
      <div className={s.row}>
        <h2 id="sec-arrival" style={{ margin: 0, fontSize: 22 }}>
          {l.arrival.title}
        </h2>
        <span className={s.private}>{l.arrival.private}</span>
      </div>
      <p className={s.info}>{l.arrival.lead}</p>
      {text("arrival_instructions", l.arrival.arrival, { rows: 5, max: 4000, placeholder: l.arrival.arrivalPlaceholder })}
      {text("departure_instructions", l.arrival.departure, { rows: 4, max: 4000, placeholder: l.arrival.departurePlaceholder })}
      {text("access_details", l.arrival.access, { rows: 3, max: 1000, placeholder: l.arrival.accessPlaceholder })}
    </section>
  );

  const point = f.latitude !== null && f.longitude !== null ? { lat: f.latitude, lng: f.longitude } : null;
  const town = (PLACES[f.country as keyof typeof PLACES] ?? [])
    .flatMap((r) => r.cities)
    .find((c) => c.name.toLowerCase() === f.municipality.trim().toLowerCase());
  const setNearby = (i: number, patch: Partial<Nearby>) => set("nearby", f.nearby.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

  const location = (
    <section className={s.panel} aria-labelledby="sec-location">
      <h2 id="sec-location">{l.location.title}</h2>
      <p className={s.panelLead}>{l.location.lead}</p>
      <div className={s.row}>
        <span className={s.muted}>{[f.municipality, countries[f.country]].filter(Boolean).join(", ")}</span>
        <span className={s.spacer} />
        {town ? (
          <button type="button" className={s.button} onClick={() => setForm((x) => (x ? { ...x, latitude: town.lat, longitude: town.lng } : x))}>
            {l.location.findTown}
          </button>
        ) : null}
        {point ? (
          <button type="button" className={s.ghost} onClick={() => setForm((x) => (x ? { ...x, latitude: null, longitude: null } : x))}>
            {l.location.removePin}
          </button>
        ) : null}
      </div>
      <PinMap
        point={point}
        fallback={town ?? CENTER[f.country] ?? CENTER.FI}
        approximate={!f.show_exact_location}
        label={l.location.title}
        onChange={(p) => setForm((x) => (x ? { ...x, latitude: round6(p.lat), longitude: round6(p.lng) } : x))}
      />
      {!point ? <p className={s.hint}>{l.location.noPin}</p> : null}
      {toggle("show_exact_location", l.location.exact)}
      <p className={s.hint}>{f.show_exact_location ? l.location.exactOn : l.location.approximate}</p>
      {err("latitude") ? <p className={s.error}>{l.invalid}</p> : null}
      <div className={s.group}>
        <h3>{l.location.nearby}</h3>
        <p className={s.hint}>{l.location.nearbyLead}</p>
        {f.nearby.length ? (
          <ul className={s.rows}>
            {f.nearby.map((n, i) => (
              <li key={i} className={`${s.rowItem} ${s.nearbyRow}`}>
                <label className={s.field}>
                  <span>{l.location.kind}</span>
                  <select className={s.select} value={n.kind} onChange={(e) => setNearby(i, { kind: e.target.value as NearbyKind })}>
                    {NEARBY.map((k) => (
                      <option key={k} value={k}>
                        {l.location.kinds[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  <span>{l.location.name}</span>
                  <input className={s.input} maxLength={120} placeholder={l.location.namePlaceholder} value={n.name} onChange={(e) => setNearby(i, { name: e.target.value })} />
                </label>
                <label className={s.field}>
                  <span>{l.location.distance}</span>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    step="0.1"
                    inputMode="decimal"
                    value={n.distance_km ?? ""}
                    onChange={(e) => setNearby(i, { distance_km: e.target.value === "" ? null : e.target.value })}
                  />
                </label>
                <button type="button" className={s.iconBtn} aria-label={l.location.removeNearby} onClick={() => set("nearby", f.nearby.filter((_, j) => j !== i))}>
                  <Trash />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <button type="button" className={s.button} onClick={() => set("nearby", [...f.nearby, { kind: "lake", name: "", distance_km: null }])}>
            {l.location.addNearby}
          </button>
        </div>
        {err("nearby") ? <p className={s.error}>{l.invalid}</p> : null}
      </div>
    </section>
  );

  const calendarSection = (
    <section className={s.panel} aria-labelledby="sec-calendar">
      <h2 id="sec-calendar">{l.calendar.title}</h2>
      <p className={s.panelLead}>{l.calendar.lead}</p>
      <div className={s.row}>
        <a className={o.primary} href={paths.hostingCalendarFor(lang, id)}>
          {l.calendar.open}
        </a>
        <a className={s.button} href={paths.hostingCalendarFor(lang, id)}>
          {l.calendar.block}
        </a>
      </div>
      <p className={s.hint}>{fill(lang, l.calendar.minStay, { n: f.min_nights ?? 1 })}</p>
      <div className={s.group}>
        <h3>{l.calendar.upcoming}</h3>
        {detail.upcoming.length ? (
          <ul className={s.stayList}>
            {detail.upcoming.map((b) => (
              <li key={b.id}>
                <SiteIcon channel={b.channel} label={b.channel} ownBooking={t.ownBooking} showName={false} />
                {fill(lang, l.calendar.stayLine, { dates: fmt.range(b.check_in, b.check_out), guests: plural(lang, l.units.guests, b.guests) })}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>{l.calendar.noUpcoming}</p>
        )}
      </div>
      <div className={s.group}>
        <h3>{l.calendar.sites}</h3>
        <p className={s.hint}>{l.calendar.sitesLead}</p>
        <ul className={s.siteRows}>
          {detail.channels.map((c) => (
            <li key={c.channel}>
              <span className={s.siteName}>
                <SiteIcon channel={c.channel} label={c.channel} ownBooking={t.ownBooking} />
              </span>
              <span className={s.badge}>
                <span className={s.dot} data-state={c.state} />
                {l.calendar.states[c.state]}
              </span>
              <span className={`${s.muted} ${s.small}`} style={{ gridColumn: "1 / -1" }}>
                {c.channel === "nettimokki"
                  ? fill(lang, l.calendar.nettimokkiHint, { address: detail.forwarding_address })
                  : c.feed_id !== null
                    ? c.last_synced_at
                      ? fill(lang, l.calendar.lastSync, { time: fmt.stamp(c.last_synced_at) })
                      : l.calendar.never
                    : ""}
                {c.error ? ` · ${c.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {text("nettimokki_url", l.calendar.nettimokki, { max: 200, placeholder: "https://www.nettimokki.com/…" })}
        <div>
          <a className={s.button} href={paths.hostingCalendarFor(lang, id)}>
            {l.calendar.manage}
          </a>
        </div>
      </div>
    </section>
  );

  // History lists which parts of the listing an edit touched, by the editor's own section names.
  const fieldNames = (fields: string[]) =>
    [...new Set(fields.map((x) => FIELD_SECTION[x] ?? "basics"))].map((sec) => l.nav[sec]).join(", ");

  const statusSection = (
    <section className={s.panel} aria-labelledby="sec-status">
      <h2 id="sec-status">{l.status.title}</h2>
      <p>
        <span className={s.badge} data-status={status}>
          {l.statusNames[status]}
        </span>
      </p>
      <p style={{ margin: 0 }}>{l.status.explain[status]}</p>
      <p className={s.info}>{l.status.external}</p>
      <div className={s.row}>
        {actionsFor(status).map((a) => (
          <button
            key={a}
            type="button"
            className={a === "publish" || a === "relist" ? o.primary : s.button}
            disabled={working || (a === "publish" && check.items.some((i) => i.essential && !i.done))}
            onClick={() => (a === "pause" || a === "archive" ? setConfirm(a) : void changeStatus(a))}
          >
            {l.status[a]}
          </button>
        ))}
      </div>
      {(status === "intake" || status === "listing") && check.items.some((i) => i.essential && !i.done) ? (
        <p className={s.hint}>
          {fill(lang, l.status.missing, {
            items: check.items.filter((i) => i.essential && !i.done).map((i) => l.checklist.items[i.key]).join(", "),
          })}
        </p>
      ) : null}
      <div className={s.group}>
        <h3>{l.status.history}</h3>
        {detail.history.length ? (
          <ul className={s.history}>
            {detail.history.map((h, i) => {
              const label = l.status.historyActions[h.action as keyof L["status"]["historyActions"]] ?? h.action;
              return (
                <li key={i}>
                  <strong>{fill(lang, label, { fields: fieldNames(h.fields) })}</strong>
                  <span className={`${s.muted} ${s.small}`}>{fill(lang, l.status.historyLine, { when: fmt.stamp(h.at), who: h.by })}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={s.muted}>{l.status.historyEmpty}</p>
        )}
      </div>
      {status === "intake" || status === "archived" ? (
        <div className={s.group}>
          <div>
            <button
              type="button"
              className={s.danger}
              onClick={() => {
                setDeleteName("");
                setConfirm("delete");
              }}
            >
              {l.status.delete}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );

  const views: Record<Section, React.ReactNode> = {
    overview, basics, photos: photosSection, amenities, pricing, rules, arrival, location, calendar: calendarSection, status: statusSection,
  };

  return (
    <div className={o.page}>
      {header}
      <main className={o.main}>
        <div className={s.editorHead}>
          <a className={s.back} href={paths.hostingListings(lang)}>
            <ArrowLeft />
            {l.back}
          </a>
        </div>
        <div className={s.editorHead}>
          <h1>{saved?.name || detail.name}</h1>
          <span className={s.badge} data-status={status}>
            {l.statusNames[status]}
          </span>
          <span className={s.spacer} />
          <a className={s.button} href={paths.hostingListingPreview(lang, id)} target="_blank" rel="noopener">
            {l.actions.preview}
          </a>
          <a className={s.button} href={paths.hostingCalendarFor(lang, id)}>
            {l.actions.calendar}
          </a>
        </div>

        {recovery ? (
          <div className={s.notice} role="alert" style={{ marginBottom: 16 }}>
            <span className={s.spacer}>{fill(lang, l.restore, { date: fmt.stamp(recovery.at) })}</span>
            <button
              type="button"
              className={s.button}
              onClick={() => {
                setForm({ ...recovery.form, descriptions: { ...recovery.form.descriptions } });
                setRecovery(null);
              }}
            >
              {l.restoreUse}
            </button>
            <button
              type="button"
              className={s.ghost}
              onClick={() => {
                forget();
                setRecovery(null);
              }}
            >
              {l.restoreDrop}
            </button>
          </div>
        ) : null}

        <div className={s.editor}>
          <nav className={s.sideNav} aria-label={l.sections}>
            {SECTIONS.map((x) => (
              <button key={x} type="button" className={s.navItem} aria-current={section === x} onClick={() => go(x)}>
                {l.nav[x]}
                {todoSections.has(x) ? <span className={s.navTodo} aria-label={l.checklist.needed} /> : null}
              </button>
            ))}
          </nav>
          <div>
            <div ref={panelRef} tabIndex={-1} style={{ outline: "none", scrollMarginTop: 90 }}>
              {views[section]}
            </div>
            <div className={s.saveBar} data-dirty={dirty}>
              <span className={s.saveState} data-dirty={dirty}>
                {dirty ? l.unsaved : l.allSaved}
              </span>
              <span className={s.spacer} />
              <button type="button" className={s.ghost} disabled={!dirty || saving} onClick={discard}>
                {l.discard}
              </button>
              <button type="button" className={o.primary} disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? l.saving : l.save}
              </button>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={confirm === "pause"} title={l.status.pauseTitle} onClose={() => setConfirm(null)}>
        <p>{l.status.pauseBody}</p>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setConfirm(null)}>
            {l.cancel}
          </button>
          <button type="button" className={o.primary} disabled={working} onClick={() => void changeStatus("pause")}>
            {l.status.pause}
          </button>
        </div>
      </Dialog>
      <Dialog open={confirm === "archive"} title={l.status.archiveTitle} onClose={() => setConfirm(null)}>
        <p>{l.status.archiveBody}</p>
        {detail.upcoming_count ? <p className={s.notice}>{plural(lang, l.status.futureBookings, detail.upcoming_count)}</p> : null}
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setConfirm(null)}>
            {l.cancel}
          </button>
          <button type="button" className={o.primary} disabled={working || detail.upcoming_count > 0} onClick={() => void changeStatus("archive")}>
            {l.status.archive}
          </button>
        </div>
      </Dialog>
      <Dialog open={confirm === "delete"} title={l.status.deleteTitle} onClose={() => setConfirm(null)}>
        <p>{l.status.deleteBody}</p>
        <label className={s.field}>
          <span>{l.status.deleteConfirm}</span>
          <input className={s.input} value={deleteName} placeholder={detail.name} onChange={(e) => setDeleteName(e.target.value)} autoComplete="off" />
        </label>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setConfirm(null)}>
            {l.cancel}
          </button>
          <button type="button" className={s.dangerSolid} disabled={working || deleteName.trim() !== detail.name} onClick={() => void remove()}>
            {l.status.deleteButton}
          </button>
        </div>
      </Dialog>
      {toasts.view}
    </div>
  );
}
