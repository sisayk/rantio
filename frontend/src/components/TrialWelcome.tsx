"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { TRIAL } from "@/i18n/messages/trial";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { Wordmark } from "./guest/icons";
import styles from "./NewsletterConfirm.module.css";

type State = "checking" | "saved" | "notSaved" | "failed";

/** Where Stripe's card page sends the owner back to after the sign-up form
 *  (/hosts/welcome?signup=<token>, with app=1 from the app). */
export default function TrialWelcome({ lang }: { lang: Lang }) {
  const t = TRIAL[lang].welcome;
  const query = useSearchParams();
  const token = query.get("signup") ?? "";
  const fromApp = query.get("app") === "1";
  const [state, setState] = useState<State>("checking");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const appLink = `rantio://list-cottage?signup=${encodeURIComponent(token)}`;

  useEffect(() => {
    let live = true;
    fetch(`/api/signups/${encodeURIComponent(token)}/card/`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { card_saved: boolean; name: string }) => {
        if (!live) return;
        setName(body.name);
        setState(body.card_saved ? "saved" : "notSaved");
        // From the app: back into it, which closes this browser sheet.
        if (fromApp) window.location.href = appLink;
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [token, fromApp, appLink]);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/signups/${encodeURIComponent(token)}/card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: fromApp }),
      });
      const body = (await res.json()) as { checkout_url?: string | null; card_saved?: boolean };
      if (body.checkout_url) {
        window.location.assign(body.checkout_url);
        return;
      }
      setState(body.card_saved ? "saved" : "failed");
    } catch {
      setState("failed");
    }
    setBusy(false);
  }

  const [title, text] =
    state === "saved"
      ? [t.title, fill(lang, t.lead, { name })]
      : state === "notSaved"
        ? [t.notSavedTitle, t.notSavedLead]
        : state === "failed"
          ? [t.notSavedTitle, fill(lang, t.failed, { email: CONTACT_EMAIL })]
          : [t.checking, ""];

  return (
    <div className={styles.page}>
      <a href={paths.hosts(lang)} className={styles.wordmark}>
        <Wordmark />
      </a>
      <main className={styles.card} aria-live="polite">
        {state === "saved" ? (
          <p aria-hidden="true" style={{ fontSize: 48, margin: 0 }}>
            🏡
          </p>
        ) : null}
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
        <div className={styles.actions}>
          {state === "notSaved" ? (
            <button type="button" className={styles.primary} onClick={retry} disabled={busy} style={{ border: 0, cursor: "pointer" }}>
              {t.retry}
            </button>
          ) : null}
          {fromApp ? (
            <a className={state === "notSaved" ? styles.quiet : styles.primary} href={appLink}>
              {t.backToApp}
            </a>
          ) : state !== "checking" ? (
            <a className={state === "notSaved" ? styles.quiet : styles.primary} href={paths.hosts(lang)}>
              {t.home}
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
