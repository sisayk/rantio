"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/i18n/locales";
import { ACCOUNT } from "@/i18n/messages/account";
import { paths } from "@/i18n/paths";
import { Wordmark } from "../guest/icons";
import chat from "../chat.module.css";

const APP_LINK = "rantio://account?payment=done";

/** Stripe sends the owner here after saving a payment method. Opened from the app, it hands back to it. */
export default function PaymentSaved({ lang }: { lang: Lang }) {
  const t = ACCOUNT[lang].profile;
  const [fromApp, setFromApp] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("app") !== "1") return;
    const timer = window.setTimeout(() => {
      setFromApp(true);
      window.location.href = APP_LINK; // closes the app's browser sheet
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={chat.guestPage}>
      <header className={chat.guestTop}>
        <a className={chat.brand} href={paths.home(lang)}>
          <Wordmark />
        </a>
      </header>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", textAlign: "center", color: "#1d2a2e" }}>
        <h1 style={{ margin: 0 }}>{t.savedMethod}</h1>
        <p style={{ marginTop: 24 }}>
          <a
            href={fromApp ? APP_LINK : paths.hosting(lang)}
            style={{ display: "inline-block", padding: "12px 18px", borderRadius: 12, background: "#1d4c3c", color: "#fff", fontWeight: 700, textDecoration: "none" }}
          >
            {t.back}
          </a>
        </p>
      </main>
    </div>
  );
}
