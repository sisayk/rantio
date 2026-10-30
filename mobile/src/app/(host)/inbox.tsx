import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useHost } from "@/state/host";
import { DAY, formatDate, formatRange, TIME, todayISO } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { SiteIcon } from "@/ui/host";
import { Avatar, Empty, Loading, Pill, Problem, Text } from "@/ui/kit";
import { TabScreen } from "@/ui/screen";

type Filter = "all" | "unread" | "archived";

export default function Inbox() {
  const { m, lang } = useT();
  const t = m.dashboard.inbox;
  const { conversations, refreshInbox } = useHost();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    refreshInbox()
      .then(() => setFailed(false))
      .catch(() => setFailed(true));
  }, [refreshInbox]);

  useFocusEffect(load);

  const rows = (conversations ?? []).filter((c) => (filter === "archived" ? c.archived : !c.archived && (filter === "all" || c.unread)));
  const today = todayISO();

  return (
    <TabScreen
      title={t.title}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refreshInbox().catch(() => setFailed(true));
        setRefreshing(false);
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginBottom: space.md }}>
        {(["all", "unread", "archived"] as const).map((k) => (
          <Chip key={k} label={t[k]} on={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>
      {failed ? <Problem text={t.error} retry={load} retryLabel={m.dashboard.retry} /> : null}
      {conversations === null ? (
        failed ? null : <Loading />
      ) : rows.length === 0 ? (
        <Empty icon="chatbubbles-outline" title={conversations.length ? t.emptyFilter : t.empty} />
      ) : (
        rows.map((c) => {
          const when = c.last_at ?? "";
          return (
            <Pressable key={c.id} onPress={() => router.push(`/thread/${c.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.ground }]} accessibilityRole="button">
              <View>
                <Avatar name={c.guest_name} />
                <View style={styles.site}>
                  <SiteIcon channel={c.channel} label={c.channel_label} showName={false} size={14} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Text v={c.unread ? "h3" : "bodyMedium"} numberOfLines={1} style={{ flex: 1 }}>
                    {c.guest_name}
                  </Text>
                  {when ? <Text v="tiny">{formatDate(lang, when, when.slice(0, 10) === today ? TIME : DAY)}</Text> : null}
                  {c.unread ? <View style={styles.dot} /> : null}
                </View>
                <Text v="small" numberOfLines={1}>
                  {c.cottage}
                  {c.check_in && c.check_out ? ` · ${formatRange(lang, c.check_in, c.check_out)}` : ""}
                </Text>
                {c.preview ? (
                  <Text v="small" color={c.unread ? colors.ink : colors.soft} numberOfLines={2}>
                    {c.preview.sender === "host" ? `${t.you}: ` : ""}
                    {c.preview.body}
                  </Text>
                ) : null}
                {c.request_status ? (
                  <Pill
                    style={{ marginTop: 4 }}
                    tone={c.request_status === "pending" ? "berry" : c.request_status === "accepted" ? "green" : "neutral"}
                    label={c.request_status === "pending" ? m.dashboard.calendar.legend.request : m.book.status[c.request_status]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green },
  site: { position: "absolute", right: -4, bottom: -4, backgroundColor: "#fff", borderRadius: 8, padding: 1 },
});
