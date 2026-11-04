"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { listedChoices, type ListedOn, MAX_SIGNUP_PHOTOS, TRIAL } from "@/i18n/messages/trial";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { ACCEPTED, preparePhoto } from "@/lib/imagePrep";
import { COUNTRIES, type Country } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import styles from "./landing.module.css";

type Field = "name" | "email" | "country" | "region" | "nettimokki_url" | "photos" | "privacy_consent" | "email_code";
type Photo = { id: number; blob: Blob; name: string; url: string };

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
  const tr = TRIAL[lang];
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [photos, setPhotos] = useState<Photo[]>([]);
  // The email check: the address a code was sent to; the form goes through with that code.
  const [email, setEmail] = useState("");
  const [codeFor, setCodeFor] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const codeStep = codeFor !== "" && codeFor === email.trim().toLowerCase();
  // Where the cottage is listed now; "none" (not anywhere yet) and the sites exclude each other.
  const [listed, setListed] = useState<ListedOn[]>([]);
  const toggleListed = (key: ListedOn) =>
    setListed((now) =>
      now.includes(key) ? now.filter((k) => k !== key) : key === "none" ? ["none"] : [...now.filter((k) => k !== "none"), key],
    );
  const [preparing, setPreparing] = useState(false);
  const nextId = useRef(1);
  const picker = useRef<HTMLInputElement>(null);
  // Let go of the previews' memory when the form goes away.
  const shown = useRef(photos);
  useEffect(() => {
    shown.current = photos;
  }, [photos]);
  useEffect(() => () => shown.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_SIGNUP_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    let problem = files.length > room ? tr.tooManyPhotos : "";
    setPreparing(true);
    const added: Photo[] = [];
    for (const file of chosen) {
      try {
        const ready = await preparePhoto(file);
        added.push({ id: nextId.current++, ...ready, url: URL.createObjectURL(ready.blob) });
      } catch (e) {
        problem = (e as Error).message === "too_big" ? tr.photoBig : tr.photoType;
      }
    }
    setPreparing(false);
    setPhotos((now) => [...now, ...added]);
    setErrors((now) => ({ ...now, photos: problem || undefined }));
  }

  function removePhoto(id: number) {
    setPhotos((now) => {
      const gone = now.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return now.filter((p) => p.id !== id);
    });
  }
  const [errors, setErrors] = useState<Errors>({});
  const [doneName, setDoneName] = useState("");
  // Where the cottage is: the country, then one of its official regions, then (optional) the town.
  const [country, setCountry] = useState<Country | "">(LANG_COUNTRY[lang] ?? "");
  const [region, setRegion] = useState("");
  const regions = country
    ? [...PLACES[country]].sort((a, b) => regionLabel(a, country, lang).localeCompare(regionLabel(b, country, lang), lang))
    : [];
  const towns = PLACES[country as Country]?.find((r) => r.id === region)?.cities.map((c) => c.name) ?? [];
  const askNettimokki = country === "FI" && listed.includes("nettimokki");

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
    if (!photos.length) e.photos = tr.photosRequired;
    if (!data.get("privacy_consent")) e.privacy_consent = f.errors.consent;
    return e;
  }

  async function sendCode(name: string): Promise<boolean> {
    try {
      const res = await fetch("/api/signups/email-code/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name, lang }),
      });
      if (res.ok) {
        setCodeFor(email.trim().toLowerCase());
        setErrors({});
        return true;
      }
      setErrors(res.status === 429 ? { form: tr.code.tooMany } : res.status === 400 ? { email: f.errors.email } : { form: f.errors.network });
    } catch {
      setErrors({ form: f.errors.network });
    }
    return false;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      (first === "photos" ? picker.current : form.querySelector<HTMLElement>(`[name="${first}"]`))?.focus();
      return;
    }

    // First the code to the email address; the form goes through once it's typed in.
    if (!codeStep) {
      setState("sending");
      if (await sendCode(String(data.get("name")).trim())) {
        setTimeout(() => form.querySelector<HTMLInputElement>('[name="email_code"]')?.focus(), 50);
      }
      setState("idle");
      return;
    }
    const emailCode = String(data.get("email_code") ?? "").replace(/\D/g, "");
    if (emailCode.length !== 6) {
      setErrors({ email_code: tr.code.wrong });
      form.querySelector<HTMLInputElement>('[name="email_code"]')?.focus();
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
      nettimokki_url: askNettimokki ? String(data.get("nettimokki_url") ?? "").trim() : "",
      listed_on: listed.join(","),
      email_code: emailCode,
      message: String(data.get("message") ?? "").trim(),
      privacy_consent: true,
      source: params.get("utm_source") ?? params.get("ref") ?? "",
      website: String(data.get("website") ?? ""),
    };

    const upload = new FormData();
    for (const [key, value] of Object.entries(body)) upload.append(key, String(value));
    photos.forEach((p) => upload.append("photos", p.blob, p.name));

    setState("sending");
    try {
      const response = await fetch("/api/signups/", { method: "POST", body: upload });
      if (response.status === 201) {
        const answer = (await response.json()) as { checkout_url?: string | null; signed_in?: boolean };
        setSignedIn(!!answer.signed_in);
        // Next: the card for the free trial, on Stripe's page; it brings the owner back to /hosts/welcome.
        if (answer.checkout_url) {
          window.location.assign(answer.checkout_url);
          return;
        }
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
        if (detail.email_code) mapped.email_code = tr.code.wrong;
        if (detail.photos) mapped.photos = String(detail.photos).includes("too_big") ? tr.photoBig : tr.photoType;
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
        {signedIn ? (
          <a className={styles.primaryButton} href={paths.hosting(lang)} style={{ marginTop: 18 }}>
            {tr.code.toDashboard}
          </a>
        ) : null}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

      <fieldset className={styles.listedSet}>
        <legend>{tr.listedOn}</legend>
        <p className={styles.photoHint}>{tr.listedHint}</p>
        <div className={styles.listedChips}>
          {listedChoices(country).map((key) => (
            <label key={key} className={styles.listedChip}>
              <input type="checkbox" checked={listed.includes(key)} onChange={() => toggleListed(key)} />
              <span>{tr.listedOptions[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {askNettimokki ? (
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

      <fieldset className={styles.photoSet} aria-describedby={`photos-hint${errors.photos ? " photos-error" : ""}`}>
        <legend>{tr.photos}</legend>
        <p id="photos-hint" className={styles.photoHint}>
          {tr.photosHint}
        </p>
        <ul className={styles.photoGrid}>
          {photos.map((p, i) => (
            <li key={p.id} className={styles.photoThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) */}
              <img src={p.url} alt={`${tr.photos} ${i + 1}`} />
              <button type="button" onClick={() => removePhoto(p.id)} aria-label={`${tr.removePhoto} ${i + 1}`}>
                ×
              </button>
            </li>
          ))}
          {photos.length < MAX_SIGNUP_PHOTOS ? (
            <li>
              <label className={styles.photoAdd} data-invalid={!!errors.photos} data-busy={preparing || undefined}>
                <input
                  ref={picker}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  multiple
                  onChange={(e) => {
                    addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                  aria-invalid={!!errors.photos}
                />
                <span aria-hidden="true">+</span>
                {tr.addPhotos}
              </label>
            </li>
          ) : null}
        </ul>
      </fieldset>
      {err("photos")}

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

      {codeStep ? (
        <div className={styles.codeStep}>
          <p role="status">{tr.code.sent.replace("{email}", email.trim())}</p>
          <label className={styles.field} data-invalid={!!errors.email_code}>
            <span>{tr.code.label}</span>
            <input
              name="email_code"
              className={styles.codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              aria-invalid={!!errors.email_code}
              aria-describedby={described("email_code")}
            />
            {err("email_code")}
          </label>
          <button type="button" className={styles.textLink} onClick={() => sendCode(String(email).trim())} disabled={state === "sending"}>
            {tr.code.resend}
          </button>
        </div>
      ) : (
        <p className={styles.cardNote}>
          <span className={styles.trialBadge}>{tr.badge}</span> {tr.cardNote}
        </p>
      )}
      <button className={styles.primaryButton} type="submit" disabled={state === "sending" || preparing}>
        {state === "sending" ? f.sending : codeStep ? tr.code.confirm : tr.submit}
      </button>
    </form>
  );
}
