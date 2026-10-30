import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { guestApi, type Thread } from "@/api";
import { getListing, listingName, unsplash } from "@/lib/listings";
import { usePrefs } from "@/state/prefs";
import { DAY, formatDate, formatRange, TIME, todayISO } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Button, Empty, Pill, Text } from "@/ui/kit";
import { TabScreen } from "@/ui/screen";

/** The guest's conversations started from this phone (each opened by its private token). */
export default function GuestMessages() {
  const { m, lang } = useT();
  const { chats } = usePrefs();
  const router = useRouter();
  const [threads, setThreads] = useState<Record<string, Thread | null>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const got = await Promise.all(chats.map((c) => guestApi.thread(c.token).then((t) => [c.token, t] as const, () => [c.token, null] as const)));
    setThreads(Object.fromEntries(got));
  }, [chats]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TabScreen
      title={m.app.tabs.messages}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {chats.length === 0 ? (
        <Empty
          icon="chatbubbles-outline"
          title={m.app.messages.empty}
          lead={m.app.messages.emptyLead}
          action={<Button label={m.app.saved.browse} onPress={() => router.navigate("/explore")} />}
        />
      ) : (
        chats.map((c) => {
          const t = threads[c.token];
          const listing = getListing(c.listing);
          const last = t?.messages[t.messages.length - 1];
          const when = last?.at ?? c.at;
          const name = t?.cottage || (listing ? listingName(m.listingNames, listing) : c.listing);
          const status = t?.request_status;
          return (
            <Pressable key={c.token} onPress={() => router.push(`/chat/${c.token}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.ground }]}>
              {listing ? (
                <Image source={unsplash(listing.photo, 120, 120)} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.greenTint }]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Text v="h3" numberOfLines={1} style={{ flex: 1 }}>
                    {t?.host_name || name}
                  </Text>
                  <Text v="tiny">{formatDate(lang, when, when.slice(0, 10) === todayISO() ? TIME : DAY)}</Text>
                </View>
                <Text v="small" numberOfLines={1}>
                  {name}
                  {t?.check_in && t.check_out ? ` · ${formatRange(lang, t.check_in, t.check_out)}` : ""}
                </Text>
                {last ? (
                  <Text v="small" color={colors.ink} numberOfLines={1}>
                    {last.sender === "guest" ? `${m.guest.chat.you}: ` : ""}
                    {last.body}
                  </Text>
                ) : null}
                {status ? (
                  <Pill
                    style={{ marginTop: 4 }}
                    tone={status === "accepted" ? "green" : status === "declined" ? "error" : "berry"}
                    label={m.book.status[status]}
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
  row: { flexDirection: "row", gap: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});
