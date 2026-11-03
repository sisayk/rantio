"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { Wordmark } from "./guest/icons";
import styles from "./NewsletterConfirm.module.css";

type State = "checking" | "confirmed" | "invalid" | "unsubscribing" | "unsubscribed";

async function post(path: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/newsletter/${path}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The page behind the link in the confirmation email: confirms on opening (in the browser,
 *  so a mail scanner fetching the link confirms nothing) and offers to unsubscribe. */
export default function NewsletterConfirm({ lang, token, t }: { lang: Lang; token: string; t: Messages["common"]["newsletter"]["page"] }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let live = true;
    post("confirm", token).then((ok) => live && setState(ok ? "confirmed" : "invalid"));
    return () => {
      live = false;
    };
  }, [token]);

  async function unsubscribe() {
    setState("unsubscribing");
    setState((await post("unsubscribe", token)) ? "unsubscribed" : "invalid");
  }

  const [title, text] =
    state === "confirmed" || state === "unsubscribing"
      ? [t.confirmed, t.confirmedText]
      : state === "unsubscribed"
        ? [t.unsubscribed, t.unsubscribedText]
        : state === "invalid"
          ? [t.invalid, t.invalidText]
          : [t.checking, ""];

  return (
    <div className={styles.page}>
      <a href={paths.home(lang)} className={styles.wordmark}>
        <Wordmark />
      </a>
      <main className={styles.card} aria-live="polite">
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
        <div className={styles.actions}>
          <a className={styles.primary} href={paths.home(lang)}>
            {t.back}
          </a>
          {state === "confirmed" || state === "unsubscribing" ? (
            <button type="button" className={styles.quiet} onClick={unsubscribe} disabled={state === "unsubscribing"}>
              {state === "unsubscribing" ? t.unsubscribing : t.unsubscribe}
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
