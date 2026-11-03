"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import styles from "./SiteFooter.module.css";

/** The footer's newsletter sign-up. Nothing is subscribed until the emailed link is clicked. */
export default function NewsletterForm({ lang, t }: { lang: Lang; t: Messages["common"]["newsletter"] }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(t.errors.email);
    setError(null);
    setState("sending");
    const params = new URLSearchParams(window.location.search);
    try {
      const response = await fetch("/api/newsletter/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          language: lang,
          source: (params.get("utm_source") ?? params.get("ref") ?? "").slice(0, 80),
          website: String(data.get("website") ?? ""),
        }),
      });
      if (response.status === 201) return setState("done");
      setError(response.status === 400 ? t.errors.email : t.errors.network);
    } catch {
      setError(t.errors.network);
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <p className={styles.newsDone} role="status">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 10.5 3.2 3L15 6.5" />
        </svg>
        {t.done}
      </p>
    );
  }

  return (
    <form className={styles.newsForm} onSubmit={onSubmit} noValidate>
      <div className={styles.newsRow}>
        <label className={styles.hidden} htmlFor="newsletter-email">
          {t.email}
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t.email}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "newsletter-error" : "newsletter-note"}
        />
        <button type="submit" disabled={state === "sending"}>
          {state === "sending" ? t.sending : t.submit}
        </button>
      </div>
      <label className={styles.honeypot} aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error ? (
        <p id="newsletter-error" className={styles.newsError} role="alert">
          {error}
        </p>
      ) : (
        <p id="newsletter-note" className={styles.newsNote}>
          {t.note} <a href={paths.privacy(lang)}>{t.privacy}</a>
        </p>
      )}
    </form>
  );
}
