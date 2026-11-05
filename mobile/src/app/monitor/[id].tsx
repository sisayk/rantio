import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { type MonitorDetail, type MonitorSettings, ownerApi } from "@/api";
import { MONITOR } from "@/i18n/messages/monitor";
import { useHost } from "@/state/host";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Chip, Stepper } from "@/ui/controls";
import { Button, Card, Icon, Loading, Problem, Section, Text } from "@/ui/kit";
import { KIND_ICONS, ReadingTiles, StatePill, stateOf, useDegrees, useWhen } from "@/ui/monitorStatus";
import { PageBar } from "@/ui/screen";

/** One box: the cottage's state now, the last 48 hours, its alerts and what sets them off. */
export default function MonitorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, f, m } = useT();
  const t = MONITOR[lang];
  const router = useRouter();
  const deg = useDegrees();
  const when = useWhen();
  const { summary } = useHost();
  const [d, setD] = useState<MonitorDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<MonitorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .monitorDevice(Number(id))
      .then((row) => {
        setD(row);
        setSettings(row.settings);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setRefreshing(false));
  }, [id]);
  useFocusEffect(load);

  if (failed && !d) return <View style={{ flex: 1, backgroundColor: colors.page }}><PageBar title={t.title} /><Problem text={m.dashboard.error} retry={load} retryLabel={m.dashboard.retry} /></View>;
  if (!d || !settings) return <View style={{ flex: 1, backgroundColor: colors.page }}><PageBar title={t.title} /><Loading /></View>;

  const changed = JSON.stringify(settings) !== JSON.stringify(d.settings);
  const save = async (extra: Partial<MonitorSettings> & { cottage?: number | null } = {}) => {
    setSaving(true);
    try {
      const row = await ownerApi.updateMonitor(d.id, { ...settings, ...extra });
      setD({ ...d, ...row });
      setSettings(row.settings);
      setSaved(true);
    } catch {
      Alert.alert(t.errors.failed);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t.remove, t.removeConfirm, [
      { text: t.removeCancel, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: async () => {
          await ownerApi.removeMonitor(d.id).catch(() => undefined);
          router.back();
        },
      },
    ]);

  const temps = d.history.map((h) => h.temp).filter((v): v is number => v != null);
  const lo = Math.min(...temps, settings.frost_limit) - 1;
  const hi = Math.max(...temps, settings.arrival_temp) + 1;
  const cottages = summary?.cottages ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={d.cottage?.name ?? t.title} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.green} />}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text v="tiny">{t.inside}</Text>
            <Text v="display" style={{ fontSize: 44, lineHeight: 50 }}>
              {deg(d.last.temp)}
            </Text>
          </View>
          <StatePill state={stateOf(d)} />
        </View>
        <Text v="tiny" style={{ marginTop: 2 }}>
          {d.last_seen_at ? f(t.updated, { when: when(d.last_seen_at) }) : t.status.waiting} · {d.occupied ? t.bookedNow : t.emptyNow}
        </Text>

        {d.alerts.length ? (
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {d.alerts.map((a) => (
              <Card key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: "#fdecea" }}>
                <Icon name={KIND_ICONS[a.kind]} size={22} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <Text v="bodyMedium" color={colors.error}>
                    {t.kinds[a.kind]}
                  </Text>
                  <Text v="tiny">
                    {t.ongoing} · {when(a.started_at)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          <ReadingTiles last={d.last} />
        </View>

        <Section title={t.last48}>
          {temps.length ? (
            <View style={styles.chart} accessibilityLabel={t.last48}>
              {d.history.map((h) => (
                <View key={h.at} style={styles.barSlot}>
                  {h.temp != null ? (
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.max(4, ((h.temp - lo) / (hi - lo)) * 100)}%` },
                        h.temp <= settings.frost_limit && { backgroundColor: colors.error },
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text v="small">{t.noHistory}</Text>
          )}
          {temps.length ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text v="tiny">{deg(Math.min(...temps))}</Text>
              <Text v="tiny">{deg(Math.max(...temps))}</Text>
            </View>
          ) : null}
        </Section>

        <Section title={t.alerts}>
          {d.recent_alerts.length ? (
            d.recent_alerts.map((a) => (
              <View key={a.id} style={styles.alertRow}>
                <Icon name={KIND_ICONS[a.kind]} size={18} color={a.ended_at ? colors.soft : colors.error} />
                <Text v="body" style={{ flex: 1 }}>
                  {t.kinds[a.kind]}
                </Text>
                <Text v="tiny">{a.ended_at ? when(a.started_at) : t.ongoing}</Text>
              </View>
            ))
          ) : (
            <Text v="small">{t.noAlerts}</Text>
          )}
        </Section>

        <Section title={t.settings}>
          <View style={{ gap: space.lg }}>
            <SettingRow label={t.frostLimit} value={deg(settings.frost_limit)}>
              <Stepper label={t.frostLimit} value={settings.frost_limit} min={-5} max={12} onChange={(v) => (setSettings({ ...settings, frost_limit: v }), setSaved(false))} />
            </SettingRow>
            <SettingRow label={t.arrivalTemp} value={deg(settings.arrival_temp)}>
              <Stepper label={t.arrivalTemp} value={settings.arrival_temp} min={10} max={25} onChange={(v) => (setSettings({ ...settings, arrival_temp: v }), setSaved(false))} />
            </SettingRow>
            <SettingRow label={t.saunaHours} value={f(t.hours, { n: settings.sauna_hours })}>
              <Stepper label={t.saunaHours} value={settings.sauna_hours} min={1} max={12} onChange={(v) => (setSettings({ ...settings, sauna_hours: v }), setSaved(false))} />
            </SettingRow>
            <Text v="tiny">{t.calendarNote}</Text>
            {changed || saved ? (
              <Button label={saved && !changed ? t.saved : t.save} icon={saved && !changed ? "checkmark" : undefined} busy={saving} disabled={!changed} onPress={() => save()} />
            ) : null}
          </View>
        </Section>

        {cottages.length ? (
          <Section title={t.cottage}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {cottages.map((c) => (
                <Chip key={c.id} label={c.name} on={d.cottage?.id === c.id} onPress={() => save({ cottage: c.id })} />
              ))}
            </View>
          </Section>
        ) : null}

        <Text v="tiny" style={{ marginTop: space.xl }}>
          {d.serial}
          {d.firmware ? ` · ${d.firmware}` : ""}
        </Text>
        <Button kind="ghost" icon="unlink-outline" label={t.remove} onPress={remove} style={{ alignSelf: "flex-start", paddingHorizontal: 0, marginTop: space.sm }} />
      </ScrollView>
    </View>
  );
}

function SettingRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Text v="body">{label}</Text>
        <Text v="smallMedium" color={colors.green}>
          {value}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: 120, flexDirection: "row", alignItems: "flex-end", gap: 1, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.ground },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2, backgroundColor: colors.green },
  alertRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
