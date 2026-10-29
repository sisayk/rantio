"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL, REGIONS } from "@/lib/content";
import { COUNTRIES } from "@/lib/listings";
import styles from "./landing.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

type Field = "name" | "email" | "region" | "nettimokki_url" | "privacy_consent";
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
  // "FI:saimaa" for a Finnish region, or a country code such as "SE".
  const [location, setLocation] = useState("");
  const inFinland = location.startsWith("FI");

  function validate(data: FormData): Errors {
    const e: Errors = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const link = String(data.get("nettimokki_url") ?? "").trim();
    if (!name) e.name = f.errors.required;
    if (!email) e.email = f.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = f.errors.email;
    if (!data.get("region")) e.region = f.errors.required;
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
    const [country, region = ""] = String(data.get("region")).split(":");
    const body = {
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      phone: String(data.get("phone") ?? "").trim(),
      language: lang,
      country,
      region,
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

      <div className={styles.fieldRow}>
        <label className={styles.field} data-invalid={!!errors.region}>
          <span>{f.region}</span>
          <select
            name="region"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            aria-invalid={!!errors.region}
            aria-describedby={described("region")}
          >
            <option value="" disabled>
              {f.regionPlaceholder}
            </option>
            <optgroup label={countries.FI}>
              {REGIONS.map((r) => (
                <option key={r} value={`FI:${r}`}>
                  {f.regions[r]}
                </option>
              ))}
            </optgroup>
            <optgroup label={f.otherCountries}>
              {COUNTRIES.filter((c) => c !== "FI").map((c) => (
                <option key={c} value={c}>
                  {countries[c]}
                </option>
              ))}
            </optgroup>
          </select>
          {err("region")}
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
