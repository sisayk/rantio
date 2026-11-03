"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { ownerApi } from "@/lib/ownerApi";
import { forgetOwnerSession } from "@/lib/useOwnerSession";
import { Wordmark } from "../guest/icons";
import styles from "./owner.module.css";

// Public IDs (not secrets), built into the site; a button shows only when its ID is set
// and the server accepts that provider (GOOGLE_CLIENT_IDS, APPLE_AUDIENCES in its .env).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const APPLE_SERVICES_ID = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID ?? "";

// Calling codes for the phone number, the page's country first.
const CALLING: [string, string][] = [
  ["FI", "+358"], ["SE", "+46"], ["NO", "+47"], ["DK", "+45"], ["IS", "+354"], ["EE", "+372"], ["LV", "+371"], ["LT", "+370"],
];
const LANG_COUNTRY: Partial<Record<Lang, string>> = { fi: "FI", sv: "SE", nb: "NO", nn: "NO", da: "DK", is: "IS", et: "EE", lv: "LV", lt: "LT" };

type Via = "email" | "phone";
type Step = { name: "start" } | { name: "code"; devCode?: string };
type Options = { sms: boolean; google: boolean; apple: boolean };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (o: Record<string, unknown>) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

/** Google, Apple, or a six-digit code by email or SMS. */
export default function OwnerLogin({
  lang,
  t,
  languageButton,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  languageButton: React.ReactNode;
}) {
  const l = t.login;
  const [options, setOptions] = useState<Options>({ sms: false, google: false, apple: false });
  const [via, setVia] = useState<Via>("email");
  const [step, setStep] = useState<Step>({ name: "start" });
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(LANG_COUNTRY[lang] ?? "FI");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleBox = useRef<HTMLDivElement>(null);

  const showGoogle = options.google && Boolean(GOOGLE_CLIENT_ID);
  const showApple = options.apple && Boolean(APPLE_SERVICES_ID);
  const callingCode = CALLING.find(([c]) => c === country)?.[1] ?? "+358";
  // "040 123 4567" with +358 → "+358401234567"; a number typed with its own + stays as it is.
  const phone = number.trim().startsWith("+") ? number.replace(/[^\d+]/g, "") : callingCode + number.replace(/\D/g, "").replace(/^0+/, "");
  const to = via === "phone" ? { phone } : { email: email.trim() };

  useEffect(() => {
    ownerApi.signInOptions().then(setOptions).catch(() => undefined);
  }, []);

  function signedIn() {
    forgetOwnerSession();
    window.location.assign(paths.hosting(lang));
  }

  async function social(provider: "google" | "apple", idToken: string) {
    setBusy(true);
    setError("");
    try {
      await ownerApi.social(provider, idToken);
      signedIn();
    } catch (err) {
      const detail = (err as { body?: { detail?: string } }).body?.detail;
      setError(detail === "no_owner" || detail === "no_email" ? l.noOwner : l.socialFailed);
      setBusy(false);
    }
  }

  // Google draws its own button (its rules); it hands back an ID token.
  useEffect(() => {
    if (!showGoogle || step.name !== "start") return;
    let gone = false;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (gone || !window.google || !googleBox.current) return;
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => social("google", r.credential), ux_mode: "popup" });
        window.google.accounts.id.renderButton(googleBox.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: googleBox.current.clientWidth || 360,
          locale: lang,
        });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
    // social() only reads the words and the language, which don't change on this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGoogle, step.name, lang]);

  async function apple() {
    setError("");
    try {
      await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
      window.AppleID?.auth.init({
        clientId: APPLE_SERVICES_ID,
        scope: "email",
        redirectURI: `${window.location.origin}${paths.hostingLogin(lang)}`,
        usePopup: true,
      });
      const res = await window.AppleID?.auth.signIn();
      if (res) await social("apple", res.authorization.id_token);
    } catch (err) {
      // Closing Apple's window isn't an error worth showing.
      if (!String((err as { error?: string }).error ?? "").includes("popup_closed")) setError(l.socialFailed);
    }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await ownerApi.requestCode(to, lang);
      setStep({ name: "code", devCode: res.dev_code });
      setCode("");
    } catch (err) {
      setError((err as { status?: number }).status === 429 ? l.tooMany : l.failed);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await ownerApi.verifyCode(to, code);
      signedIn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 400 ? l.wrongCode : status === 429 ? l.tooMany : l.failed);
      setBusy(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <header className={styles.loginTop}>
        <a className={styles.brand} href={paths.hosts(lang)}>
          <Wordmark />
        </a>
        {languageButton}
      </header>

      <main className={styles.loginCard}>
        <h1>{l.title}</h1>
        {step.name === "start" ? (
          <>
            {showGoogle || showApple ? (
              <div className={styles.socialButtons}>
                {showApple ? (
                  <button type="button" className={styles.appleButton} onClick={apple} disabled={busy}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.6-2.66 1.37-.58.67-1.09 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.27Z" />
                    </svg>
                    {l.apple}
                  </button>
                ) : null}
                {showGoogle ? <div ref={googleBox} className={styles.googleBox} aria-label={l.google} /> : null}
                <p className={styles.orLine}>
                  <span>{l.or}</span>
                </p>
              </div>
            ) : null}
            <form onSubmit={sendCode} className={styles.loginForm}>
              {options.sms ? (
                <div className={styles.viaTabs} role="tablist">
                  {(["email", "phone"] as const).map((v) => (
                    <button key={v} type="button" role="tab" aria-selected={via === v} onClick={() => setVia(v)}>
                      {v === "email" ? l.byEmail : l.byPhone}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.loginLead}>{l.lead}</p>
              )}
              {via === "email" ? (
                <>
                  <label htmlFor="owner-email">{l.email}</label>
                  <input
                    id="owner-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </>
              ) : (
                <>
                  <label htmlFor="owner-phone">{l.phone}</label>
                  <div className={styles.phoneRow}>
                    <select aria-label={l.countryCode} value={country} onChange={(e) => setCountry(e.target.value)} disabled={busy}>
                      {CALLING.map(([c, dial]) => (
                        <option key={c} value={c}>
                          {c} {dial}
                        </option>
                      ))}
                    </select>
                    <input
                      id="owner-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      required
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </>
              )}
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? l.sending : l.send}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={verify} className={styles.loginForm}>
            <p className={styles.loginLead} role="status">
              {via === "phone" ? fill(lang, l.sentToPhone, { phone }) : fill(lang, l.sentTo, { email: email.trim() })}
            </p>
            {step.devCode ? <p className={styles.devCode}>{fill(lang, l.devCode, { code: step.devCode })}</p> : null}
            <label htmlFor="owner-code">{l.code}</label>
            <input
              id="owner-code"
              className={styles.codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
            />
            <button type="submit" className={styles.primary} disabled={busy || code.length !== 6}>
              {busy ? l.verifying : l.verify}
            </button>
            <div className={styles.loginLinks}>
              <button type="button" className={styles.textButton} onClick={() => setStep({ name: "start" })}>
                {via === "phone" ? l.otherPhone : l.otherEmail}
              </button>
              <button type="button" className={styles.textButton} onClick={() => sendCode()} disabled={busy}>
                {l.resend}
              </button>
            </div>
          </form>
        )}
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.loginJoin}>
          {l.notOwner} <a href={paths.hosts(lang)}>{l.join}</a>
        </p>
      </main>
    </div>
  );
}
