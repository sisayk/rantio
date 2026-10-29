"use client";

import { useState } from "react";
import type { Lang } from "@/lib/content";
import { dashboardHref, ownerApi } from "@/lib/ownerApi";
import { ownerContent } from "@/lib/ownerContent";
import { Logo } from "../guest/icons";
import styles from "./owner.module.css";

type Step = { name: "email" } | { name: "code"; devCode?: string };

/** Email, then the six-digit code we send to it. */
export default function OwnerLogin({ lang }: { lang: Lang }) {
  const t = ownerContent[lang];
  const l = t.login;
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await ownerApi.requestCode(email.trim(), lang);
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
      await ownerApi.verifyCode(email.trim(), code);
      window.location.assign(dashboardHref(lang));
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 400 ? l.wrongCode : status === 429 ? l.tooMany : l.failed);
      setBusy(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <header className={styles.loginTop}>
        <a className={styles.brand} href={lang === "fi" ? "/omistajille" : "/en/hosts"}>
          <Logo className={styles.logo} />
          Stugora
        </a>
        <a className={styles.quietLink} href={t.otherLang.login} hrefLang={lang === "fi" ? "en" : "fi"}>
          {t.otherLang.label}
        </a>
      </header>

      <main className={styles.loginCard}>
        <h1>{l.title}</h1>
        {step.name === "email" ? (
          <form onSubmit={sendCode} className={styles.loginForm}>
            <p className={styles.loginLead}>{l.lead}</p>
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
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? l.sending : l.send}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className={styles.loginForm}>
            <p className={styles.loginLead} role="status">
              {l.sentTo(email.trim())}
            </p>
            {step.devCode ? <p className={styles.devCode}>{l.devCode(step.devCode)}</p> : null}
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
              <button type="button" className={styles.textButton} onClick={() => setStep({ name: "email" })}>
                {l.otherEmail}
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
          {l.notOwner} <a href={l.joinHref}>{l.join}</a>
        </p>
      </main>
    </div>
  );
}
