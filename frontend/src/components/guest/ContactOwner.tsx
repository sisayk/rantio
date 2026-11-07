"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { guestApi } from "@/lib/ownerApi";
import chat from "../chat.module.css";
import OnTop from "../OnTop";
import styles from "./guest.module.css";

/** "Message the owner" on a cottage page: a short form that opens a private conversation.
 *  AI writing help turns a few words into the message; the guest checks it and sends it. */
export default function ContactOwner({
  lang,
  listingId,
  cottage,
  maxGuests,
  t,
}: {
  lang: Lang;
  listingId: string;
  cottage: string;
  maxGuests: number;
  t: Messages["guest"]["contact"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={chat.contactButton} onClick={() => setOpen(true)}>
        {t.button}
      </button>
      {open ? <ContactDialog lang={lang} listingId={listingId} cottage={cottage} maxGuests={maxGuests} t={t} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ContactDialog({
  lang,
  listingId,
  cottage,
  maxGuests,
  t,
  onClose,
}: {
  lang: Lang;
  listingId: string;
  cottage: string;
  maxGuests: number;
  t: Messages["guest"]["contact"];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(false);
  const [ai, setAi] = useState<"idle" | "done" | "failed" | "off">("idle");
  // Signed in on this browser: the message goes out with the account's name and email, so the
  // form doesn't ask for them (Change shows the fields again).
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  // Today on this device, once (the dialog only lives a few minutes): no dates in the past.
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    let live = true;
    fetch("/api/owner/me/", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { name?: string; email?: string } | null) => {
        if (live && v?.email) setMe({ name: v.name ?? "", email: v.email });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const known = !!me && !!me.name && !editing;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // The dialog itself, not its first field: on a phone that would open the keyboard at once.
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  const fields = (el: HTMLFormElement) => {
    const f = new FormData(el);
    const text = (name: string) => String(f.get(name) ?? "").trim();
    const adults = text("adults") ? Number(text("adults")) : null;
    return { text, adults, children: adults && text("children") ? Number(text("children")) : adults ? 0 : null };
  };

  async function help() {
    if (!form.current) return;
    const { text, adults, children } = fields(form.current);
    setWriting(true);
    try {
      const { draft } = await guestApi.draftEnquiry({
        listing: listingId,
        cottage,
        lang,
        name: text("name"),
        check_in: (text("check_in") && text("check_out") && text("check_in")) || null,
        check_out: (text("check_in") && text("check_out") && text("check_out")) || null,
        adults,
        children,
        draft: body.trim(),
      });
      setBody(draft);
      setAi("done");
    } catch (err) {
      setAi((err as { status?: number }).status === 503 ? "off" : "failed");
    } finally {
      setWriting(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { text, adults, children } = fields(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { token } = await guestApi.enquire({
        listing: listingId,
        name: text("name"),
        email: text("email"),
        lang,
        body: text("body"),
        check_in: text("check_in") || null,
        check_out: text("check_out") || null,
        adults,
        children,
        website: text("website"),
      });
      window.location.assign(paths.guestChat(lang, token));
    } catch (err) {
      setError((err as { status?: number }).status === 429 ? t.tooMany : t.failed);
      setBusy(false);
    }
  }

  return (
    <OnTop>
      <div className={styles.modalBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={dialog} tabIndex={-1} className={`${styles.modal} ${chat.contactModal}`} role="dialog" aria-modal="true" aria-labelledby="contact-title">
          <header className={styles.modalHeader}>
            <button type="button" className={styles.modalClose} aria-label={t.close} onClick={onClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
            <h2 id="contact-title">{t.title}</h2>
          </header>
          <form ref={form} className={chat.contactForm} onSubmit={submit}>
            <p className={chat.contactLead}>
              <strong>{cottage}</strong> · {t.lead}
            </p>
            {known && me ? (
              <p className={chat.fieldHint}>
                <input type="hidden" name="name" value={me.name} />
                <input type="hidden" name="email" value={me.email} />
                {t.sendingAs} <strong>{me.name}</strong> · {me.email}{" "}
                <button type="button" className={chat.linkButton} onClick={() => setEditing(true)} disabled={busy}>
                  {t.change}
                </button>
              </p>
            ) : (
              <div className={chat.fieldRow} key={me ? "me" : "anon"}>
                <label>
                  {t.name}
                  <input name="name" required maxLength={120} autoComplete="name" defaultValue={me?.name ?? ""} disabled={busy} />
                </label>
                <label>
                  {t.email}
                  <input name="email" type="email" required autoComplete="email" defaultValue={me?.email ?? ""} disabled={busy} />
                </label>
              </div>
            )}
            <p className={chat.fieldHint}>{t.emailHint}</p>
            <div className={`${chat.fieldRow} ${chat.pairRow}`}>
              <label>
                <span>{t.checkIn} <span className={chat.optional}>({t.optional})</span></span>
                <input name="check_in" type="date" min={today} onChange={(e) => setCheckIn(e.target.value)} disabled={busy} />
              </label>
              <label>
                <span>{t.checkOut} <span className={chat.optional}>({t.optional})</span></span>
                <input name="check_out" type="date" min={checkIn || today} disabled={busy} />
              </label>
            </div>
            <div className={`${chat.fieldRow} ${chat.pairRow}`}>
              <label>
                <span>{t.adults} <span className={chat.optional}>({t.optional})</span></span>
                <input name="adults" type="number" min={1} max={maxGuests} inputMode="numeric" disabled={busy} />
              </label>
              <label>
                <span>{t.children} <span className={chat.optional}>({t.optional})</span></span>
                <input name="children" type="number" min={0} max={Math.max(0, maxGuests - 1)} inputMode="numeric" disabled={busy} />
              </label>
            </div>
            <label>
              {t.message}
              <textarea
                name="body"
                required
                rows={5}
                maxLength={4000}
                placeholder={t.placeholder}
                disabled={busy || writing}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (ai !== "idle") setAi("idle");
                }}
              />
            </label>
            <div className={chat.aiRow}>
              <button type="button" className={chat.aiButton} onClick={help} disabled={busy || writing} aria-busy={writing}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
                </svg>
                {writing ? t.aiWorking : body.trim() ? t.aiImprove : t.aiWrite}
              </button>
              {ai !== "idle" || !body.trim() ? (
                <p className={chat.fieldHint} role={ai === "failed" || ai === "off" ? "alert" : undefined}>
                  {ai === "done" ? t.aiNote : ai === "off" ? t.aiOff : ai === "failed" ? t.aiFailed : t.aiHint}
                </p>
              ) : null}
            </div>
            {/* Hidden from people; bots that fill every field are turned away. */}
            <input name="website" tabIndex={-1} autoComplete="off" className={chat.trap} aria-hidden="true" />
            {error ? (
              <p className={chat.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.modalFooter}>
              <span />
              <button type="submit" className={chat.send} disabled={busy}>
                {busy ? t.sending : t.send}
              </button>
            </div>
          </form>
        </div>
      </div>
    </OnTop>
  );
}
