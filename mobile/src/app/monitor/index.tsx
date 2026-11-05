import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { type MonitorRow, ownerApi } from "@/api";
import { MONITOR } from "@/i18n/messages/monitor";
import { useT } from "@/text/i18n";
import { colors, shadow, space } from "@/theme";
import { Button, Card, Icon, Text } from "@/ui/kit";
import { MonitorDetails } from "@/ui/monitor";
import { KIND_ICONS, StatePill, stateOf, useDegrees, useWhen } from "@/ui/monitorStatus";
import { PageBar } from "@/ui/screen";

/** Menu → Mökki monitor: the host's boxes, one card each, or the box and its waitlist until they have one. */
export default function Monitors() {
  const { lang, f } = useT();
  const t = MONITOR[lang];
  const router = useRouter();
  const deg = useDegrees();
  const when = useWhen();
  const [rows, setRows] = useState<MonitorRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .monitors()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setRefreshing(false));
  }, []);
  useFocusEffect(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={t.title} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.green} />}
      >
        {rows && rows.length ? (
          <>
            {rows.map((d) => (
              <Pressable key={d.id} onPress={() => router.push(`/monitor/${d.id}`)} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.85 }}>
                <Card style={{ gap: space.sm, ...shadow }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text v="h3" numberOfLines={1}>
                        {d.cottage?.name ?? (d.name || t.noCottage)}
                      </Text>
                      <Text v="tiny">
                        {d.serial}
                        {d.last_seen_at ? ` · ${f(t.updated, { when: when(d.last_seen_at) })}` : ""}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.faint} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <View>
                      <Text v="tiny">{t.inside}</Text>
                      <Text v="display">{deg(d.last.temp)}</Text>
                    </View>
                    <StatePill state={stateOf(d)} />
                  </View>
                  {d.alerts.map((a) => (
                    <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <Icon name={KIND_ICONS[a.kind]} size={18} color={colors.error} />
                      <Text v="smallMedium" color={colors.error}>
                        {t.kinds[a.kind]}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Pressable>
            ))}
            <Button kind="secondary" icon="add" label={t.connect} onPress={() => router.push("/monitor/connect")} />
          </>
        ) : (
          <>
            <Button icon="add" label={t.connect} onPress={() => router.push("/monitor/connect")} />
            <MonitorDetails />
          </>
        )}
      </ScrollView>
    </View>
  );
}
