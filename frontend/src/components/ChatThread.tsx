"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import type { ChatMessage } from "@/lib/ownerApi";
import styles from "./chat.module.css";

type Words = { placeholder: string; send: string; sending: string; failed: string; hint?: string };

/** Messages as bubbles (yours on the right), grouped by day, with a reply box under them. */
export default function ChatThread({
  lang,
  messages,
  mine,
  names,
  note,
  words,
  onSend,
}: {
  lang: Lang;
  messages: ChatMessage[];
  mine: "guest" | "host";
  names: Record<"guest" | "host", string>;
  note?: string;
  words: Words;
  onSend: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLOListElement>(null);

  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    return {
      day: new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" }),
      time: new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" }),
    };
  }, [lang]);

  // Keep the newest message in view as messages arrive (scrolls the list, not the page).
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSend(body);
      setDraft("");
    } catch {
      setError(words.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.thread}>
      <ol className={styles.messages} ref={list}>
        {messages.map((m, i) => {
          const at = new Date(m.at);
          const showDay = i === 0 || new Date(messages[i - 1].at).toDateString() !== at.toDateString();
          return (
            <li key={m.id} className={styles.messageItem}>
              {showDay ? <p className={styles.day}>{fmt.day.format(at)}</p> : null}
              <div className={styles.bubbleRow} data-mine={m.sender === mine}>
                <div className={styles.bubble}>
                  <span className="visually-hidden">{names[m.sender]}: </span>
                  {m.body}
                </div>
                <time className={styles.time} dateTime={m.at}>
                  {m.sender === mine ? "" : `${names[m.sender]} · `}
                  {fmt.time.format(at)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      <form className={styles.composer} onSubmit={send}>
        <label className="visually-hidden" htmlFor="chat-reply">
          {words.placeholder}
        </label>
        <textarea
          id="chat-reply"
          rows={3}
          maxLength={4000}
          placeholder={words.placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
          }}
          disabled={busy}
        />
        <div className={styles.composerFoot}>
          <span className={styles.hint}>{words.hint ?? ""}</span>
          <button type="submit" className={styles.send} disabled={busy || !draft.trim()}>
            {busy ? words.sending : words.send}
          </button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>
      {note ? <p className={styles.threadNote}>{note}</p> : null}
    </div>
  );
}
