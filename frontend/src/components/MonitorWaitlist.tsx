"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import styles from "./landing.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
// Where the cottage most likely is, from the page's language; Finland for English.
const COUNTRY: Record<Lang, string> = { en: "FI", fi: "FI", sv: "SE", nb: "NO", nn: "NO", da: "DK", is: "IS", et: "EE", lv: "LV", lt: "LT", de: "FI" };
const RENTS = ["yes", "not_yet", "no"] as const;

/** "Tell me when it's ready" for the Mökki monitor: an email, whether they rent, consent. */
export default function MonitorWaitlist({ lang, t, privacyLink }: { lang: Lang; t: Messages["owner"]["monitor"]; privacyLink: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [rents, setRents] = useState<(typeof RENTS)[number] | "">("");
  const [error, setError] = useState<{ field: "email" | "consent" | "form"; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError({ field: "email", text: t.errors.email });
    if (!data.get("privacy_consent")) return setError({ field: "consent", text: t.errors.consent });
    setError(null);
    setState("sending");
    const params = new URLSearchParams(window.location.search);
    try {
      const response = await fetch(`${API_URL}/api/monitor-waitlist/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          language: lang,
          country: COUNTRY[lang],
          rents,
          privacy_consent: true,
          source: params.get("utm_source") ?? params.get("ref") ?? "",
          website: String(data.get("website") ?? ""),
        }),
      });
      if (response.status === 201) return setState("done");
      const body = response.status === 400 ? ((await response.json()) as Record<string, unknown>) : {};
      setError(body.email ? { field: "email", text: t.errors.email } : { field: "form", text: t.errors.network });
    } catch {
      setError({ field: "form", text: t.errors.network });
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <p className={styles.monitorDone} role="status">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 10.5 3.2 3L15 6.5" />
        </svg>
        {t.done}
      </p>
    );
  }

  return (
    <form className={styles.monitorForm} onSubmit={onSubmit} noValidate aria-labelledby="monitor-form-title">
      <h3 id="monitor-form-title" className={styles.monitorFormTitle}>
        {t.formTitle}
      </h3>
      <fieldset className={styles.monitorRents}>
        <legend>{t.rents}</legend>
        <div>
          {RENTS.map((r) => (
            <button key={r} type="button" aria-pressed={rents === r} onClick={() => setRents(rents === r ? "" : r)}>
              {t.rentsOptions[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className={styles.monitorEmail}>
        <label className={styles.visuallyHidden} htmlFor="monitor-email">
          {t.email}
        </label>
        <input
          id="monitor-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t.email}
          aria-invalid={error?.field === "email"}
          aria-describedby={error ? "monitor-error" : undefined}
        />
        <button className={styles.primaryButton} type="submit" disabled={state === "sending"}>
          {state === "sending" ? t.sending : t.submit}
        </button>
      </div>
      <label className={styles.honeypot} aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className={styles.consent} data-invalid={error?.field === "consent"}>
        <input name="privacy_consent" type="checkbox" aria-invalid={error?.field === "consent"} />
        <span>
          {t.consent}{" "}
          <a href={paths.privacy(lang)} target="_blank" rel="noopener">
            {privacyLink}
          </a>
        </span>
      </label>
      {error ? (
        <p id="monitor-error" className={styles.formError} role="alert">
          {error.text}
        </p>
      ) : null}
    </form>
  );
}
