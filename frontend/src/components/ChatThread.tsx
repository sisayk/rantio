"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import type { ChatMessage } from "@/lib/ownerApi";
import styles from "./chat.module.css";

type Words = { placeholder: string; send: string; sending: string; failed: string; hint?: string };

type AssistWords = {
  suggest: string;
  improve: string;
  again: string;
  working: string;
  notes: string;
  notesPlaceholder: string;
  drafted: string;
  notSetUp: string;
  failed: string;
  addNotes: string;
  hideNotes: string;
};

/** AI help for the reply box: it only ever fills the box; the person edits and sends. */
export type Assist = {
  words: AssistWords;
  /** Resolves to the suggested text; rejects with { status } on failure (503 = not switched on). */
  onDraft: (notes: string, draft: string) => Promise<string>;
};

/** Messages as bubbles (yours on the right), grouped by day, with a reply box under them. */
export default function ChatThread({
  lang,
  messages,
  mine,
  names,
  note,
  words,
  onSend,
  assist,
}: {
  lang: Lang;
  messages: ChatMessage[];
  mine: "guest" | "host";
  names: Record<"guest" | "host", string>;
  note?: string;
  words: Words;
  onSend: (body: string) => Promise<void>;
  assist?: Assist;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null); // the AI's last text, while unedited or edited
  const [assistError, setAssistError] = useState("");

  async function draftReply() {
    if (!assist || drafting) return;
    setDrafting(true);
    setAssistError("");
    try {
      // With the person's own words in the box (not an earlier suggestion), the AI improves them.
      const own = suggested === null ? draft : "";
      const text = await assist.onDraft(notes, own);
      setDraft(text);
      setSuggested(text);
      box.current?.focus();
    } catch (err) {
      setAssistError((err as { status?: number }).status === 503 ? assist.words.notSetUp : assist.words.failed);
    } finally {
      setDrafting(false);
    }
  }

  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    return {
      day: new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" }),
      time: new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" }),
    };
  }, [lang]);

  // Keep the newest message in view as messages arrive and as the reply box grows
  // (scrolls the list, not the page), unless the person has scrolled up to read.
  const pinned = useRef(true);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    pinned.current = true;
  }, [messages.length]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const keep = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    keep.observe(el);
    return () => keep.disconnect();
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSend(body);
      setDraft("");
      setSuggested(null);
      setNotes("");
    } catch {
      setError(words.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.thread}>
      <ol
        className={styles.messages}
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
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
        {assist ? (
          <div className={styles.assist}>
            <div className={styles.assistBar}>
              <button type="button" className={styles.assistButton} onClick={draftReply} disabled={drafting || busy}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3c.6 3.6 1.9 5 5.5 5.5-3.6.6-4.9 1.9-5.5 5.5-.6-3.6-1.9-4.9-5.5-5.5C10.1 8 11.4 6.6 12 3Z" />
                  <path d="M18.5 14c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5Z" />
                </svg>
                {drafting
                  ? assist.words.working
                  : suggested !== null
                    ? assist.words.again
                    : draft.trim()
                      ? assist.words.improve
                      : assist.words.suggest}
              </button>
              <button type="button" className={styles.linkButton} onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes}>
                {showNotes ? assist.words.hideNotes : assist.words.addNotes}
              </button>
            </div>
            {showNotes ? (
              <label className={styles.assistNotes}>
                <span>{assist.words.notes}</span>
                <input
                  value={notes}
                  maxLength={1000}
                  placeholder={assist.words.notesPlaceholder}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void draftReply();
                    }
                  }}
                />
              </label>
            ) : null}
            {assistError ? (
              <p className={styles.error} role="alert">
                {assistError}
              </p>
            ) : null}
          </div>
        ) : null}
        <label className="visually-hidden" htmlFor="chat-reply">
          {words.placeholder}
        </label>
        {suggested !== null ? <p className={styles.drafted}>{assist?.words.drafted}</p> : null}
        <textarea
          ref={box}
          id="chat-reply"
          data-suggested={suggested !== null}
          rows={suggested !== null ? 5 : 3}
          maxLength={4000}
          placeholder={words.placeholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value.trim()) setSuggested(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
          }}
          disabled={busy || drafting}
          aria-busy={drafting}
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
