"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photo of the cottage */

import { useCallback, useEffect, useState } from "react";
import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { getListing, listingName, unsplash } from "@/lib/listings";
import { REVIEWS } from "@/i18n/messages/reviews";
import { guestApi, type Thread } from "@/lib/ownerApi";
import ChatThread from "./ChatThread";
import { Wordmark } from "./guest/icons";
import styles from "./chat.module.css";
import rating from "./ratings.module.css";

const POLL_MS = 20_000;

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; thread: Thread };

/** A guest's private conversation with an owner, opened with the link we emailed them. */
export default function GuestChat({
  lang,
  token,
  t,
  requestWords,
  listingNames,
  languageButton,
}: {
  lang: Lang;
  token: string;
  t: Messages["guest"]["chat"];
  /** How a booking request made through the owner's link stands. */
  requestWords: Messages["book"]["status"];
  listingNames: Record<string, string>;
  languageButton: React.ReactNode;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const refresh = useCallback(async () => {
    try {
      setLoad({ state: "ready", thread: await guestApi.thread(token) });
    } catch (err) {
      setLoad((prev) =>
        (err as { status?: number }).status === 404 ? { state: "missing" } : prev.state === "ready" ? prev : { state: "error" },
      );
    }
  }, [token]);

  useEffect(() => {
    // The first load happens after mount; later ones keep the page up to date while it is open.
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function send(body: string) {
    setLoad({ state: "ready", thread: await guestApi.send(token, body) });
  }

  const header = (
    <header className={styles.guestTop}>
      <a className={styles.brand} href={paths.home(lang)}>
        <Wordmark />
      </a>
      {languageButton}
    </header>
  );

  if (load.state !== "ready") {
    return (
      <div className={styles.guestPage}>
        {header}
        <main className={styles.guestMain}>
          <p className={styles.note} aria-busy={load.state === "loading"}>
            {load.state === "loading" ? t.loading : load.state === "missing" ? t.notFound : t.failed}
          </p>
        </main>
      </div>
    );
  }

  const th = load.thread;
  const listing = getListing(th.listing_slug);
  const cottage = listing ? listingName(listingNames, listing) : th.cottage;
  const last = th.messages[th.messages.length - 1];

  return (
    <div className={styles.guestPage}>
      {header}
      <main className={styles.guestMain}>
        <div className={styles.guestCard}>
          {listing ? <img src={unsplash(listing.photo, 240, 240, listing.photoCrop)} alt="" width={72} height={72} /> : null}
          <div>
            <h1>{fill(lang, t.title, { cottage })}</h1>
            <p>{th.host_name ? fill(lang, t.withHost, { name: th.host_name }) : t.withRantio}</p>
            {listing ? <a href={paths.cottage(lang, listing.id)}>{t.viewCottage}</a> : null}
          </div>
        </div>
        {th.request_status ? (
          <p className={styles.requestDone} data-status={th.request_status} role="status">
            {requestWords[th.request_status]}
          </p>
        ) : null}
        {th.can_review ? (
          <div className={rating.prompt}>
            <strong>{REVIEWS[lang].prompt.title}</strong>
            <a href={paths.review(lang, token)}>{REVIEWS[lang].prompt.action}</a>
          </div>
        ) : null}
        <p className={styles.keepLink}>{t.keepLink}</p>
        <div className={styles.guestThread}>
          <ChatThread
            lang={lang}
            messages={th.messages}
            mine="guest"
            names={{ guest: t.you, host: th.host_name || t.host }}
            note={last?.sender === "guest" ? t.waiting : undefined}
            words={{ placeholder: t.placeholder, send: t.send, sending: t.sending, failed: t.failed }}
            onSend={send}
          />
        </div>
      </main>
    </div>
  );
}
