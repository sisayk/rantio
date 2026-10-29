"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill, languageName, plural } from "@/i18n/format";
import { isLang, LANG_INFO, type Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { type ConversationRow, ownerApi, SignedOut, type Thread } from "@/lib/ownerApi";
import { ArrowLeft } from "../guest/icons";
import ChatThread from "../ChatThread";
import HostingHeader from "./HostingHeader";
import SiteIcon from "./SiteIcon";
import chat from "../chat.module.css";
import styles from "./owner.module.css";

type Filter = "all" | "unread" | "archived";
const POLL_MS = 20_000;

/** Every guest conversation, from stugora.fi and the booking sites, beside the one being read. */
export default function OwnerInbox({
  lang,
  t,
  units,
  languageButton,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  units: Messages["guest"]["units"];
  languageButton: React.ReactNode;
}) {
  const i = t.inbox;
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [owner, setOwner] = useState("");
  const openRef = useRef<number | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof SignedOut) window.location.replace(paths.hostingLogin(lang));
      else setFailed(true);
    },
    [lang],
  );

  const loadList = useCallback(async () => {
    try {
      const res = await ownerApi.conversations();
      setRows(res.results);
      setFailed(false);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const loadThread = useCallback(
    async (id: number) => {
      try {
        const th = await ownerApi.thread(id);
        if (openRef.current === id) setThread(th);
        // Reading it clears its unread mark in the list too.
        setRows((r) => r?.map((c) => (c.id === id ? { ...c, unread: false } : c)) ?? r);
      } catch (err) {
        fail(err);
      }
    },
    [fail],
  );

  useEffect(() => {
    const first = window.setTimeout(() => {
      // Opened from an email ("?c=12"), the conversation shows straight away.
      const fromLink = Number(new URLSearchParams(window.location.search).get("c")) || null;
      openRef.current = fromLink;
      if (fromLink) setOpenId(fromLink);
      ownerApi.me().then((me) => setOwner(me.name), () => undefined);
      void loadList();
      if (fromLink) void loadThread(fromLink);
    }, 0);
    const timer = window.setInterval(() => {
      void loadList();
      if (openRef.current) void loadThread(openRef.current);
    }, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadList, loadThread]);

  function open(id: number | null) {
    openRef.current = id;
    setOpenId(id);
    setThread(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", String(id));
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
    if (id) void loadThread(id);
  }

  async function reply(body: string) {
    if (!openId) return;
    const th = await ownerApi.reply(openId, body);
    setThread(th);
    void loadList();
  }

  async function toggleArchive() {
    if (!thread) return;
    const row = await ownerApi.archive(thread.id, !thread.archived).catch(fail);
    if (!row) return;
    setThread({ ...thread, archived: row.archived });
    setRows((r) => r?.map((c) => (c.id === row.id ? row : c)) ?? r);
  }

  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    const time = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" });
    const day = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
    return {
      when: (iso: string) => {
        const d = new Date(iso);
        return d.toDateString() === new Date().toDateString() ? time.format(d) : day.format(d);
      },
      range: (a: string, b: string) => `${day.format(new Date(`${a}T12:00:00`))} – ${day.format(new Date(`${b}T12:00:00`))}`,
    };
  }, [lang]);

  const shown = (rows ?? []).filter((c) =>
    filter === "archived" ? c.archived : !c.archived && (filter === "all" || c.unread),
  );
  const unread = (rows ?? []).filter((c) => c.unread).length;
  const siteName = (c: ConversationRow) => (c.channel === "direct" ? "Stugora" : c.channel_label);
  const stayLine = (c: ConversationRow) =>
    [
      c.check_in && c.check_out ? fmt.range(c.check_in, c.check_out) : null,
      c.check_in && c.check_out
        ? plural(lang, t.nights, Math.round((Date.parse(c.check_out) - Date.parse(c.check_in)) / 86_400_000))
        : null,
      c.guests ? plural(lang, units.guests, c.guests) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className={styles.page}>
      <HostingHeader lang={lang} t={t} languageButton={languageButton} active="messages" ownerName={owner} unread={unread} />
      <main className={chat.inboxMain}>
        <div className={chat.inbox} data-open={openId !== null}>
          <section className={chat.list} aria-labelledby="inbox-title">
            <div className={chat.listHead}>
              <h1 id="inbox-title">{i.title}</h1>
              <div className={chat.filters} role="group" aria-label={i.title}>
                {(["all", "unread", "archived"] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {i[f]}
                    {f === "unread" && unread ? ` (${unread})` : ""}
                  </button>
                ))}
              </div>
            </div>
            {failed && !rows ? (
              <p className={chat.note}>{i.error}</p>
            ) : !rows ? (
              <p className={chat.note} aria-busy="true">
                {i.loading}
              </p>
            ) : shown.length === 0 ? (
              <p className={chat.note}>{rows.length ? i.emptyFilter : i.empty}</p>
            ) : (
              <ul className={chat.rows}>
                {shown.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={chat.row}
                      aria-current={c.id === openId ? "true" : undefined}
                      data-unread={c.unread}
                      onClick={() => open(c.id)}
                    >
                      <span className={chat.avatar} aria-hidden="true">
                        {c.guest_name.charAt(0)}
                        <span className={chat.avatarSite}>
                          <SiteIcon channel={c.channel} label={c.channel_label} ownBooking={t.ownBooking} showName={false} />
                        </span>
                      </span>
                      <span className={chat.rowText}>
                        <span className={chat.rowTop}>
                          <strong>{c.guest_name}</strong>
                          {c.last_at ? <time dateTime={c.last_at}>{fmt.when(c.last_at)}</time> : null}
                        </span>
                        <span className={chat.rowMeta}>
                          {c.cottage} · {c.channel === "direct" ? i.enquiry : siteName(c)}
                        </span>
                        {c.preview ? (
                          <span className={chat.rowPreview}>
                            {c.preview.sender === "host" ? `${i.you}: ` : ""}
                            {c.preview.body}
                          </span>
                        ) : null}
                      </span>
                      {c.unread ? <span className={chat.dot} aria-label={i.unread} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={chat.threadPane} aria-live="polite">
            {openId === null ? (
              <p className={chat.choose}>{i.choose}</p>
            ) : !thread ? (
              <p className={chat.note} aria-busy="true">
                {i.loading}
              </p>
            ) : (
              <>
                <div className={chat.threadHead}>
                  <button type="button" className={chat.back} onClick={() => open(null)}>
                    <ArrowLeft className={styles.icon16} />
                    {i.back}
                  </button>
                  <div className={chat.threadTitle}>
                    <h2>{thread.guest_name}</h2>
                    <p>
                      <SiteIcon channel={thread.channel} label={thread.channel_label} ownBooking={t.ownBooking} />
                      <span>{thread.cottage}</span>
                      {stayLine(thread) ? <span>{stayLine(thread)}</span> : null}
                      {isLang(thread.guest_language) && thread.guest_language !== lang ? (
                        <span>{fill(lang, i.writesIn, { language: languageName(lang, thread.guest_language) })}</span>
                      ) : null}
                    </p>
                  </div>
                  <button type="button" className={styles.outline} onClick={toggleArchive}>
                    {thread.archived ? i.unarchive : i.archive}
                  </button>
                </div>
                <ChatThread
                  lang={lang}
                  messages={thread.messages}
                  mine="host"
                  names={{ guest: thread.guest_name, host: i.you }}
                  note={thread.replies_here ? i.directNote : fill(lang, i.siteNote, { site: siteName(thread) })}
                  words={{ placeholder: i.placeholder, send: i.send, sending: i.sending, failed: i.failed, hint: i.sendHint }}
                  onSend={reply}
                />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
