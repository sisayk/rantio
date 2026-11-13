"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANG_INFO, type Lang, LANGS } from "@/i18n/locales";
import { switchLangPath } from "@/i18n/paths";
import type { Messages } from "@/i18n";
import styles from "./LanguagePicker.module.css";

type Words = Messages["common"]["language"];
/** Each language's name in the page's language and in English, from the server. */
export type LanguageNames = Record<Lang, { local: string; english: string }>;

const normalise = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Remembers the choice, then opens the same page, with the same search, in that language. */
function choose(to: Lang) {
  document.cookie = `${LANG_COOKIE}=${to}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
  const { pathname, search, hash } = window.location;
  // A full load, so <html lang>, metadata and every word on the page switch together.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${switchLangPath(pathname, to)}${search}${hash}`);
}

function GlobeIcon() {
  return (
    <svg className={styles.globe} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

/** The searchable list of languages, each in its own name with the page language's name beside it. */
export function LanguageDialog({
  lang,
  t,
  names,
  onClose,
}: {
  lang: Lang;
  t: Words;
  names: LanguageNames;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const options = useMemo(
    () =>
      LANGS.map((code) => {
        const native = LANG_INFO[code].native;
        const { local, english } = names[code];
        return {
          code,
          native,
          // "ruotsi" under "Svenska" on a Finnish page; nothing under the page's own language.
          hint: normalise(local) === normalise(native) ? "" : local.charAt(0).toUpperCase() + local.slice(1),
          haystack: normalise(`${native} ${local} ${english} ${code}`),
        };
      }),
    [names],
  );
  const q = normalise(query.trim());
  const shown = q ? options.filter((o) => o.haystack.includes(q)) : options;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Phones get the list straight away; the keyboard would hide half of it.
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
    else dialog.current?.querySelector<HTMLElement>("[aria-current='true']")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog.current) {
        // Keep Tab inside the dialog.
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button, input")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  // Drawn straight into <body>: inside a header with a blur or a transform, a fixed-position
  // backdrop would be measured against that header and end up squeezed above the page.
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.head}>
          <h2 id={titleId}>{t.title}</h2>
          <button type="button" className={styles.close} aria-label={t.close} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {shown.length ? (
          <ul className={styles.list}>
            {shown.map((o) => {
              const current = o.code === lang;
              return (
                <li key={o.code}>
                  <button
                    type="button"
                    lang={o.code}
                    className={styles.option}
                    aria-current={current}
                    onClick={() => (current ? onClose() : choose(o.code))}
                  >
                    <span className={styles.names}>
                      <span className={styles.native}>{o.native}</span>
                      {o.hint ? (
                        <span className={styles.hint} lang={lang}>
                          {o.hint}
                        </span>
                      ) : null}
                    </span>
                    {current ? (
                      <svg className={styles.check} viewBox="0 0 24 24" role="img" aria-label={t.current}>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty} role="status">
            {t.empty.replace("{query}", query.trim())}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Globe button showing the current language; opens the dialog. */
export default function LanguageButton({
  lang,
  t,
  names,
  className,
  compact = false,
}: {
  lang: Lang;
  t: Words;
  names: LanguageNames;
  className?: string;
  /** Icon and code only, for narrow headers. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${className ?? ""}`}
        aria-haspopup="dialog"
        aria-label={`${t.button}: ${LANG_INFO[lang].native}`}
        onClick={() => setOpen(true)}
      >
        <GlobeIcon />
        <span className={compact ? styles.code : undefined}>{compact ? lang.toUpperCase() : LANG_INFO[lang].native}</span>
      </button>
      {open ? <LanguageDialog lang={lang} t={t} names={names} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
