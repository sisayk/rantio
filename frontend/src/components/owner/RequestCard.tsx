"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import { fill, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { formatPrice, isCurrency } from "@/lib/currency";
import { type BookingRequestRow, ownerApi, SignedOut } from "@/lib/ownerApi";
import styles from "./calendar.module.css";

type Words = Messages["dashboard"]["calendar"]["requests"];

/** A booking request from the owner's link, with the price to charge and Accept / Decline.
 *  Shown on the calendar page and above the conversation in the inbox. */
export default function RequestCard({
  lang,
  t,
  nightsWord,
  req,
  cottage,
  showChatLink = true,
  onDone,
}: {
  lang: Lang;
  t: Words;
  nightsWord: Messages["dashboard"]["nights"];
  req: BookingRequestRow;
  cottage?: string;
  showChatLink?: boolean;
  onDone: (status: "accepted" | "declined") => void;
}) {
  const [payout, setPayout] = useState(req.estimate);
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [error, setError] = useState("");
  const currency = isCurrency(req.currency) ? req.currency : "EUR";
  const day = new Intl.DateTimeFormat(LANG_INFO[lang].intl, { weekday: "short", day: "numeric", month: "short" });
  const dates = `${day.format(new Date(`${req.check_in}T12:00:00`))} – ${day.format(new Date(`${req.check_out}T12:00:00`))}`;

  async function answer(action: "accept" | "decline") {
    setBusy(action);
    setError("");
    try {
      if (action === "accept") await ownerApi.acceptRequest(req.id, payout.replace(",", ".") || "0");
      else await ownerApi.declineRequest(req.id);
      onDone(action === "accept" ? "accepted" : "declined");
    } catch (err) {
      if (err instanceof SignedOut) window.location.replace(paths.hostingLogin(lang));
      const code = (err as { body?: { detail?: string } }).body?.detail;
      setError(code === "taken" ? t.taken : t.failed);
      setBusy("");
    }
  }

  return (
    <article className={styles.request} aria-label={req.guest_name}>
      <header className={styles.requestHead}>
        <strong>{req.guest_name}</strong>
        {cottage ? <span>{cottage}</span> : null}
      </header>
      <p className={styles.requestDates}>
        {dates} · {plural(lang, nightsWord, req.nights)}
      </p>
      <p className={styles.requestMeta}>
        {fill(lang, t.guests, { adults: req.adults, children: req.children })}
        {req.guest_phone ? (
          <>
            {" · "}
            {t.phone}: <a href={`tel:${req.guest_phone.replace(/\s/g, "")}`}>{req.guest_phone}</a>
          </>
        ) : null}
      </p>
      {req.message ? <blockquote className={styles.requestMessage}>{req.message}</blockquote> : null}
      {req.free ? (
        <>
          <label className={styles.payout}>
            <span>{t.payout}</span>
            <span className={styles.payoutInput}>
              <input
                inputMode="decimal"
                value={payout}
                onChange={(e) => setPayout(e.target.value.replace(/[^\d.,]/g, ""))}
                aria-describedby={`est-${req.id}`}
              />
              <span aria-hidden="true">{currency}</span>
            </span>
            <small id={`est-${req.id}`}>{fill(lang, t.estimate, { amount: formatPrice(lang, Number(req.estimate), currency) })}</small>
          </label>
          <p className={styles.requestNote}>{t.acceptNote}</p>
        </>
      ) : (
        <p className={styles.requestWarn} role="status">
          {t.taken}
        </p>
      )}
      {error ? (
        <p className={styles.requestWarn} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.requestActions}>
        {req.free ? (
          <button type="button" className={styles.primaryBtn} disabled={!!busy} onClick={() => answer("accept")}>
            {busy === "accept" ? t.accepting : t.accept}
          </button>
        ) : null}
        <button type="button" className={styles.outlineBtn} disabled={!!busy} onClick={() => answer("decline")}>
          {busy === "decline" ? t.declining : t.decline}
        </button>
        {showChatLink ? (
          <a className={styles.textLink} href={`${paths.hostingMessages(lang)}?c=${req.id}`}>
            {t.openChat}
          </a>
        ) : null}
      </div>
    </article>
  );
}
