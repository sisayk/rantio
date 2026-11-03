"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { COUNTRIES, type Country } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import styles from "./landing.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

type Field = "name" | "email" | "country" | "region" | "nettimokki_url" | "privacy_consent";

// The country the form starts with, from the page's language (English: none chosen yet).
const LANG_COUNTRY: Partial<Record<Lang, Country>> = {
  fi: "FI",
  sv: "SE",
  nb: "NO",
  nn: "NO",
  da: "DK",
  is: "IS",
  et: "EE",
  lv: "LV",
  lt: "LT",
};
type Errors = Partial<Record<Field | "form", string>>;

type Props = {
  lang: Lang;
  f: Messages["owner"]["form"];
  /** Country names in the page's language, from the server (see GuestHome). */
  countries: Record<string, string>;
};

export default function SignupForm({ lang, f: words, countries }: Props) {
  const f = { ...words, errors: { ...words.errors, network: words.errors.network.replace("{email}", CONTACT_EMAIL) } };
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [doneName, setDoneName] = useState("");
  // Where the cottage is: the country, then one of its official regions, then (optional) the town.
  const [country, setCountry] = useState<Country | "">(LANG_COUNTRY[lang] ?? "");
  const [region, setRegion] = useState("");
  const regions = country
    ? [...PLACES[country]].sort((a, b) => regionLabel(a, country, lang).localeCompare(regionLabel(b, country, lang), lang))
    : [];
  const towns = PLACES[country as Country]?.find((r) => r.id === region)?.cities.map((c) => c.name) ?? [];
  const inFinland = country === "FI";

  function validate(data: FormData): Errors {
    const e: Errors = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const link = String(data.get("nettimokki_url") ?? "").trim();
    if (!name) e.name = f.errors.required;
    if (!email) e.email = f.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = f.errors.email;
    if (!data.get("country")) e.country = f.errors.required;
    else if (!data.get("region")) e.region = f.errors.required;
    if (link && !/^https?:\/\/([a-z0-9-]+\.)*nettimokki\.com(\/|$)/i.test(link)) e.nettimokki_url = f.errors.nettimokki;
    if (!data.get("privacy_consent")) e.privacy_consent = f.errors.consent;
    return e;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const body = {
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      phone: String(data.get("phone") ?? "").trim(),
      language: lang,
      country,
      region,
      place: String(data.get("place") ?? "")
        .trim()
        .slice(0, 100),
      cottage_count: Number(data.get("cottage_count") ?? 1),
      nettimokki_url: country === "FI" ? String(data.get("nettimokki_url") ?? "").trim() : "",
      message: String(data.get("message") ?? "").trim(),
      privacy_consent: true,
      source: params.get("utm_source") ?? params.get("ref") ?? "",
      website: String(data.get("website") ?? ""),
    };

    setState("sending");
    try {
      const response = await fetch(`${API_URL}/api/signups/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 201) {
        setDoneName(body.name.split(" ")[0]);
        setState("done");
        return;
      }
      if (response.status === 429) {
        setErrors({ form: f.errors.tooMany });
      } else if (response.status === 400) {
        const detail = (await response.json()) as Record<string, unknown>;
        const mapped: Errors = {};
        if (detail.email) mapped.email = f.errors.email;
        if (detail.name) mapped.name = f.errors.required;
        if (detail.country) mapped.country = f.errors.required;
        if (detail.region) mapped.region = f.errors.required;
        if (detail.nettimokki_url) mapped.nettimokki_url = f.errors.nettimokki;
        if (detail.privacy_consent) mapped.privacy_consent = f.errors.consent;
        setErrors(Object.keys(mapped).length ? mapped : { form: f.errors.network });
      } else {
        setErrors({ form: f.errors.network });
      }
    } catch {
      setErrors({ form: f.errors.network });
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div className={styles.success} role="status">
        <p className={styles.successTitle}>{f.successTitle}</p>
        <p>{f.success.replace("{name}", doneName)}</p>
      </div>
    );
  }

  const err = (field: Field) =>
    errors[field] ? (
      <span id={`${field}-error`} className={styles.fieldError}>
        {errors[field]}
      </span>
    ) : null;
  const described = (field: Field) => (errors[field] ? `${field}-error` : undefined);

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.fieldGroup}>
        <label className={styles.groupField} data-invalid={!!errors.name}>
          <span>{f.name}</span>
          <input name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={described("name")} />
        </label>
        <label className={styles.groupField} data-invalid={!!errors.email}>
          <span>{f.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!errors.email}
            aria-describedby={described("email")}
          />
        </label>
        <label className={styles.groupField}>
          <span>
            {f.phone} <em>({f.optional})</em>
          </span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>
      {err("name")}
      {err("email")}

      <fieldset className={styles.locationSet}>
        <legend>{f.region}</legend>
        <div className={styles.fieldRow}>
          <label className={styles.field} data-invalid={!!errors.country}>
            <span>{f.country}</span>
            <select
              name="country"
              value={country}
              autoComplete="country"
              onChange={(e) => {
                setCountry(e.target.value as Country | "");
                setRegion("");
              }}
              aria-invalid={!!errors.country}
              aria-describedby={described("country")}
            >
              <option value="" disabled>
                {f.countryPlaceholder}
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countries[c]}
                </option>
              ))}
            </select>
            {err("country")}
          </label>
          <label className={styles.field} data-invalid={!!errors.region}>
            <span>{f.regionLabel}</span>
            <select
              name="region"
              value={region}
              disabled={!country}
              onChange={(e) => setRegion(e.target.value)}
              aria-invalid={!!errors.region}
              aria-describedby={described("region")}
            >
              <option value="" disabled>
                {country ? f.regionPlaceholder : f.regionFirst}
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {regionLabel(r, country as Country, lang)}
                </option>
              ))}
            </select>
            {err("region")}
          </label>
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>
              {f.place} <em>({f.optional})</em>
            </span>
            {/* Any town or municipality; the region's larger towns are offered as you type. */}
            <input name="place" list="signup-towns" maxLength={100} autoComplete="address-level2" disabled={!region} />
            <datalist id="signup-towns">
              {towns.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className={styles.field}>
            <span>{f.count}</span>
            <select name="cottage_count" defaultValue="1">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 5 ? "5+" : n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {inFinland ? (
        <label className={styles.field} data-invalid={!!errors.nettimokki_url}>
          <span>
            {f.nettimokki} <em>({f.optional})</em>
          </span>
          <input
            name="nettimokki_url"
            type="url"
            inputMode="url"
            placeholder="https://www.nettimokki.com/…"
            aria-invalid={!!errors.nettimokki_url}
            aria-describedby={described("nettimokki_url")}
          />
          {err("nettimokki_url")}
        </label>
      ) : null}

      <label className={styles.field}>
        <span>
          {f.message} <em>({f.optional})</em>
        </span>
        <textarea name="message" rows={3} maxLength={2000} />
      </label>

      <label className={styles.honeypot} aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className={styles.consent} data-invalid={!!errors.privacy_consent}>
        <input
          name="privacy_consent"
          type="checkbox"
          aria-invalid={!!errors.privacy_consent}
          aria-describedby={described("privacy_consent")}
        />
        <span>
          {f.consent}{" "}
          <a href={paths.privacy(lang)} target="_blank" rel="noopener">
            {f.privacyLink}
          </a>
        </span>
      </label>
      {err("privacy_consent")}

      {errors.form ? (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={state === "sending"}>
        {state === "sending" ? f.sending : f.submit}
      </button>
    </form>
  );
}
