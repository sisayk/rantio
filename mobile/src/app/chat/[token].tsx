import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";

import { ApiError, guestApi, Offline, type Thread } from "@/api";
import { getListing } from "@/lib/listings";
import { formatRange } from "@/text/dates";
import { registerGuestPush } from "@/state/push";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { ChatFrame, Composer, Messages } from "@/ui/chat";
import { Button, Card, Empty, Loading, Pill, Problem, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";

/** The guest's side of a conversation, opened by its private token. */
export default function GuestChat() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { m, lang, f } = useT();
  const c = m.guest.chat;
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    guestApi
      .thread(token)
      .then((t) => {
        setThread(t);
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
  }, [token]);

  // Notify this phone when the owner answers (the system asks for permission once).
  useEffect(() => {
    registerGuestPush(token).catch(() => undefined);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener("change", (s) => s === "active" && load());
      const timer = setInterval(load, 30000);
      return () => {
        sub.remove();
        clearInterval(timer);
      };
    }, [load]),
  );

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setThread(await guestApi.send(token, text.trim()));
      setText("");
    } catch (e) {
      setProblem(e instanceof Offline ? m.app.common.offline : c.failed);
    } finally {
      setBusy(false);
    }
  };

  const listing = thread ? getListing(thread.listing_slug) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar
        title={thread ? thread.cottage : ""}
        right={listing ? <Button small kind="ghost" label={c.viewCottage} onPress={() => router.push(`/cottage/${listing.id}`)} /> : null}
      />
      {state === "loading" ? (
        <Loading />
      ) : state === "missing" ? (
        <Empty icon="link-outline" title={c.notFound} />
      ) : state === "error" || !thread ? (
        <View style={{ padding: space.xl }}>
          <Problem text={m.app.common.offline} retry={load} retryLabel={m.dashboard.retry} />
        </View>
      ) : (
        <ChatFrame>
          <Messages
            lang={lang}
            messages={thread.messages}
            mine="guest"
            theirName={thread.host_name || m.guest.chat.host}
            header={
              <Card style={{ gap: 4, marginBottom: space.md }}>
                <Text v="h3">{f(c.title, { cottage: thread.cottage })}</Text>
                <Text v="small">{thread.host_name ? f(c.withHost, { name: thread.host_name }) : c.withRantio}</Text>
                {thread.check_in && thread.check_out ? <Text v="small">{formatRange(lang, thread.check_in, thread.check_out)}</Text> : null}
                {thread.request_status ? (
                  <Pill
                    style={{ marginTop: 6 }}
                    tone={thread.request_status === "accepted" ? "green" : thread.request_status === "declined" ? "error" : "berry"}
                    label={m.book.status[thread.request_status]}
                  />
                ) : null}
              </Card>
            }
            footer={
              thread.messages.every((x) => x.sender === "guest") ? (
                <Text v="small" style={{ textAlign: "center", marginTop: space.md }}>
                  {c.waiting}
                </Text>
              ) : null
            }
          />
          <Composer
            value={text}
            onChange={setText}
            onSend={send}
            busy={busy}
            placeholder={c.placeholder}
            sendLabel={c.send}
            above={problem ? <View style={{ paddingHorizontal: space.md }}><Problem text={problem} /></View> : null}
          />
        </ChatFrame>
      )}
    </View>
  );
}
