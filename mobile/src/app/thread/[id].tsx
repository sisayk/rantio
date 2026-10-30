import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";

import { ApiError, Offline, ownerApi, type Thread } from "@/api";
import { useHost } from "@/state/host";
import { DAY_WEEKDAY, formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { ChatFrame, Composer, Messages } from "@/ui/chat";
import { Field } from "@/ui/form";
import { SiteIcon } from "@/ui/host";
import { Button, Card, Empty, IconButton, Loading, Problem, Text } from "@/ui/kit";
import { RequestCard } from "@/ui/request";
import { PageBar } from "@/ui/screen";

/** The owner's side of a conversation: reply, ask the AI for a draft, answer a booking request. */
export default function OwnerThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, lang, f, p, language } = useT();
  const t = m.dashboard.inbox;
  const { refreshInbox, refresh: refreshHost } = useHost();
  const [thread, setThread] = useState<Thread | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .thread(pk)
      .then((th) => {
        setThread(th);
        setState("ok");
        void refreshInbox().catch(() => undefined); // it's read now: the badge follows
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
  }, [pk, refreshInbox]);

  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener("change", (s) => s === "active" && load());
      return () => sub.remove();
    }, [load]),
  );

  useEffect(() => {
    ownerApi
      .assistant()
      .then((r) => setAi(r.enabled))
      .catch(() => setAi(false));
  }, []);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setThread(await ownerApi.reply(pk, text.trim()));
      setText("");
      setDrafted(false);
    } catch (e) {
      setProblem(e instanceof Offline ? m.app.common.offline : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    setDrafting(true);
    setProblem(null);
    try {
      const r = await ownerApi.draft(pk, notes, text);
      setText(r.draft);
      setDrafted(true);
    } catch (e) {
      setProblem(e instanceof ApiError && e.body.detail === "ai_not_configured" ? t.ai.notSetUp : t.ai.failed);
    } finally {
      setDrafting(false);
    }
  };

  const toggleArchive = async () => {
    if (!thread) return;
    const row = await ownerApi.archive(pk, !thread.archived).catch(() => null);
    if (row) {
      setThread({ ...thread, archived: row.archived });
      void refreshInbox().catch(() => undefined);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar
        title={thread?.guest_name ?? ""}
        right={
          thread ? (
            <IconButton
              name={thread.archived ? "arrow-undo-outline" : "archive-outline"}
              filled={false}
              label={thread.archived ? t.unarchive : t.archive}
              onPress={toggleArchive}
            />
          ) : null
        }
      />
      {state === "loading" ? (
        <Loading />
      ) : state === "missing" ? (
        <Empty icon="chatbubbles-outline" title={t.emptyFilter} />
      ) : state === "error" || !thread ? (
        <View style={{ padding: space.xl }}>
          <Problem text={t.error} retry={load} retryLabel={m.dashboard.retry} />
        </View>
      ) : (
        <ChatFrame>
          <Messages
            lang={lang}
            messages={thread.messages}
            mine="host"
            theirName={thread.guest_name}
            header={
              <View style={{ gap: space.md, marginBottom: space.md }}>
                <Card style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md }}>
                    <Text v="h3" style={{ flex: 1 }}>
                      {thread.cottage}
                    </Text>
                    <SiteIcon channel={thread.channel} label={thread.channel_label} />
                  </View>
                  {thread.check_in && thread.check_out ? (
                    <Text v="small" color={colors.ink}>
                      {formatDate(lang, thread.check_in, DAY_WEEKDAY)} – {formatDate(lang, thread.check_out, DAY_WEEKDAY)}
                      {thread.guests ? ` · ${p(m.guest.units.guests, thread.guests + (thread.children ?? 0))}` : ""}
                    </Text>
                  ) : null}
                  {thread.guest_language && thread.guest_language !== lang ? (
                    <Text v="small">{f(t.writesIn, { language: language(thread.guest_language) })}</Text>
                  ) : null}
                  {thread.guest_phone ? (
                    <Text v="small" color={colors.lake} onPress={() => Linking.openURL(`tel:${thread.guest_phone.replace(/\s/g, "")}`)}>
                      {m.dashboard.calendar.requests.phone}: {thread.guest_phone}
                    </Text>
                  ) : null}
                  <Text v="tiny" style={{ marginTop: 4 }}>
                    {thread.replies_here ? t.directNote : f(t.siteNote, { site: thread.channel_label })}
                  </Text>
                </Card>
                {thread.request && thread.request_status === "pending" ? (
                  <RequestCard
                    req={thread.request}
                    onDone={() => {
                      load();
                      void refreshHost();
                    }}
                  />
                ) : null}
              </View>
            }
          />
          <Composer
            value={text}
            onChange={(v) => {
              setText(v);
              if (!v) setDrafted(false);
            }}
            onSend={send}
            busy={busy}
            placeholder={t.placeholder}
            sendLabel={t.send}
            above={
              <View style={{ paddingHorizontal: space.md, gap: space.sm, paddingTop: space.sm }}>
                {problem ? <Problem text={problem} /> : null}
                {drafted ? (
                  <Text v="tiny" color={colors.green}>
                    {t.ai.drafted}
                  </Text>
                ) : null}
                {ai ? (
                  <>
                    {showNotes ? <Field label={t.ai.notes} value={notes} onChangeText={setNotes} placeholder={t.ai.notesPlaceholder} /> : null}
                    <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                      <Button
                        small
                        kind="secondary"
                        icon="sparkles-outline"
                        label={drafting ? t.ai.working : drafted ? t.ai.again : text.trim() ? t.ai.improve : t.ai.suggest}
                        busy={drafting}
                        onPress={suggest}
                      />
                      <Button small kind="ghost" label={showNotes ? t.ai.hideNotes : t.ai.addNotes} onPress={() => setShowNotes(!showNotes)} />
                    </View>
                  </>
                ) : null}
              </View>
            }
          />
        </ChatFrame>
      )}
    </View>
  );
}
