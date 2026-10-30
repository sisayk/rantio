import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type CalendarData, type CalendarEntry, ownerApi, SignedOut } from "@/api";
import { useHost } from "@/state/host";
import { addDays, addMonths, DAY_LONG, formatDate, formatRange, MONTH_YEAR, monthStart, parseISO, todayISO, weekdayNames } from "@/text/dates";
import { useT } from "@/text/i18n";
import { calendarColors, colors, radius, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { Field } from "@/ui/form";
import { siteName } from "@/ui/host";
import { Button, Card, Empty, IconButton, Loading, Problem, Section, tap, Text } from "@/ui/kit";
import { monthDays } from "@/ui/range-calendar";
import { RequestCard } from "@/ui/request";
import { SheetBar, TabScreen } from "@/ui/screen";

type Kind = CalendarEntry["kind"] | "clash";
const key = (e: CalendarEntry) => `${e.kind}-${e.id}`;
const covers = (e: CalendarEntry, day: string) => e.start <= day && day < e.end;
const PRIORITY: CalendarEntry["kind"][] = ["booking", "site", "block", "request"];

export default function HostCalendar() {
  const t = useT();
  const { m, lang, f } = t;
  const c = m.dashboard.calendar;
  const router = useRouter();
  const { refresh: refreshHost } = useHost();
  const [month, setMonth] = useState(() => monthStart(todayISO()));
  const [data, setData] = useState<CalendarData | null>(null);
  const [failed, setFailed] = useState(false);
  const [cottageId, setCottageId] = useState<number | null>(null);
  const [pick, setPick] = useState<{ start: string; end?: string } | null>(null);
  const [pickError, setPickError] = useState("");
  const [note, setNote] = useState("");
  const [shownDay, setShownDay] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (from: string) => {
    try {
      const d = await ownerApi.calendar(from, 1);
      setData(d);
      setFailed(false);
      setCottageId((cur) => (cur && d.cottages.some((x) => x.id === cur) ? cur : d.cottages[0]?.id ?? null));
    } catch (e) {
      if (!(e instanceof SignedOut)) setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(month);
    }, [load, month]),
  );

  const cottage = data?.cottages.find((x) => x.id === cottageId) ?? null;
  const entries = useMemo(() => (data && cottage ? data.entries.filter((e) => e.cottage_id === cottage.id) : []), [data, cottage]);
  const pairs = useMemo(() => data?.conflicts ?? [], [data]);
  const weekdays = useMemo(() => weekdayNames(lang), [lang]);
  const today = data?.today ?? todayISO();

  const dayInfo = useCallback(
    (day: string) => {
      const items = entries.filter((e) => covers(e, day));
      const keys = new Set(items.map(key));
      const clash = pairs.some(([a, b]) => keys.has(a) && keys.has(b));
      const main = PRIORITY.map((k) => items.find((e) => e.kind === k)).find(Boolean);
      const kind: Kind | null = clash ? "clash" : main?.kind ?? null;
      return { items, kind, first: !!main && main.start === day, last: !!main && addDays(main.end, -1) === day, main };
    },
    [entries, pairs],
  );

  const isBusy = (day: string) => entries.some((e) => e.kind !== "request" && covers(e, day));

  const choose = (day: string) => {
    tap();
    setPickError("");
    const { items } = dayInfo(day);
    if (items.length && (items.some((e) => e.kind !== "request") || !pick)) {
      setPick(null);
      setShownDay(day);
      return;
    }
    if (!pick || pick.end || day < pick.start) return setPick({ start: day });
    for (let d = pick.start; d <= day; d = addDays(d, 1)) {
      if (isBusy(d)) {
        setPickError(c.pick.busy);
        return setPick({ start: day });
      }
    }
    setPick({ start: pick.start, end: day });
  };

  const closeDates = async () => {
    if (!cottage || !pick?.end) return;
    setWorking(true);
    try {
      await ownerApi.closeDates(cottage.id, pick.start, addDays(pick.end, 1), note.trim());
      setPick(null);
      setNote("");
      await load(month);
    } catch {
      setPickError(c.requests.failed);
    } finally {
      setWorking(false);
    }
  };

  const reopen = async (id: number) => {
    setWorking(true);
    try {
      await ownerApi.reopenDates(id);
      setShownDay(null);
      await load(month);
    } finally {
      setWorking(false);
    }
  };

  const go = (n: number) => {
    setShownDay(null);
    setMonth(n === 0 ? monthStart(todayISO()) : addMonths(month, n));
  };

  if (!data) {
    return (
      <TabScreen title={c.title}>
        {failed ? <Problem text={m.dashboard.error} retry={() => load(month)} retryLabel={m.dashboard.retry} /> : <Loading />}
      </TabScreen>
    );
  }

  const requests = data.requests.filter((r) => !cottage || r.cottage_id === cottage.id);
  const shown = shownDay ? dayInfo(shownDay) : null;

  return (
    <View style={{ flex: 1 }}>
      <TabScreen
        title={c.title}
        right={cottage ? <IconButton name="settings-outline" label={m.app.menu.settings} onPress={() => router.push(`/cottage-settings/${cottage.id}`)} /> : null}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load(month);
          setRefreshing(false);
        }}
        contentStyle={{ paddingBottom: pick ? 260 : space.xxl * 2 }}
      >
        {data.cottages.length === 0 ? (
          <Empty icon="home-outline" title={c.empty} />
        ) : (
          <>
            {data.cottages.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginBottom: space.lg }}>
                {data.cottages.map((x) => (
                  <Chip
                    key={x.id}
                    label={x.name}
                    on={x.id === cottageId}
                    onPress={() => {
                      setCottageId(x.id);
                      setPick(null);
                    }}
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.monthBar}>
              <IconButton name="chevron-back" label={c.prev} onPress={() => go(-1)} />
              <Pressable onPress={() => go(0)} accessibilityRole="button" accessibilityLabel={c.today} style={{ flex: 1 }}>
                <Text v="h2" style={{ textAlign: "center", textTransform: "capitalize" }}>
                  {formatDate(lang, month, MONTH_YEAR)}
                </Text>
              </Pressable>
              <IconButton name="chevron-forward" label={c.next} onPress={() => go(1)} />
            </View>

            <View style={styles.week}>
              {weekdays.map((w, i) => (
                <Text key={i} v="tiny" style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {monthDays(month).map((day, i) => {
                if (!day) return <View key={`b${i}`} style={styles.cell} />;
                const info = dayInfo(day);
                const color = info.kind ? calendarColors[info.kind] : null;
                const picked = !!pick && (day === pick.start || (!!pick.end && day >= pick.start && day <= pick.end));
                const past = day < today;
                return (
                  <Pressable
                    key={day}
                    onPress={() => choose(day)}
                    style={styles.cell}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDate(lang, day, DAY_LONG)}${info.kind ? `, ${c.legend[info.kind]}` : ""}`}
                  >
                    {color ? (
                      <View
                        style={[
                          styles.band,
                          { backgroundColor: color, opacity: past ? 0.45 : 1 },
                          info.first && { left: 4, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                          info.last && { right: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
                        ]}
                      />
                    ) : null}
                    {picked ? <View style={styles.picked} /> : null}
                    <Text
                      v="smallMedium"
                      color={color ? "#fff" : past ? colors.faint : colors.ink}
                      style={day === today ? { textDecorationLine: "underline", fontWeight: "800" } : undefined}
                    >
                      {parseISO(day).getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              {(["booking", "site", "block", "request", "clash"] as const).map((k) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: calendarColors[k] }} />
                  <Text v="tiny">{c.legend[k]}</Text>
                </View>
              ))}
            </View>
            {!pick ? (
              <Text v="small" style={{ marginTop: space.md }}>
                {c.pick.hint}
              </Text>
            ) : null}

            <Section title={c.requests.title}>
              <Text v="small" style={{ marginBottom: space.md }}>
                {c.requests.lead}
              </Text>
              {requests.length === 0 ? (
                <Text v="small">{c.requests.empty}</Text>
              ) : (
                <View style={{ gap: space.md }}>
                  {requests.map((r) => (
                    <RequestCard
                      key={r.id}
                      req={r}
                      cottage={data.cottages.length > 1 ? data.cottages.find((x) => x.id === r.cottage_id)?.name : undefined}
                      showChatLink
                      onDone={() => {
                        void load(month);
                        void refreshHost();
                      }}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}
      </TabScreen>

      {pick ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.pickPanelWrap}>
          <SafeAreaView edges={["bottom"]} style={styles.pickPanel}>
            {pick.end ? (
              <>
                <Text v="h3">{f(c.pick.title, { dates: formatRange(lang, pick.start, addDays(pick.end, 1)) })}</Text>
                <Field label={c.pick.note} value={note} onChangeText={setNote} placeholder={c.pick.notePlaceholder} />
              </>
            ) : (
              <Text v="body">{f(c.pick.start, { date: formatDate(lang, pick.start, DAY_LONG) })}</Text>
            )}
            {pickError ? <Problem text={pickError} /> : null}
            <View style={{ flexDirection: "row", gap: space.sm, justifyContent: "flex-end" }}>
              <Button
                kind="secondary"
                label={c.pick.cancel}
                onPress={() => {
                  setPick(null);
                  setPickError("");
                }}
              />
              {pick.end ? <Button label={working ? c.pick.closing : c.pick.close} busy={working} onPress={closeDates} /> : null}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      ) : null}

      <Modal visible={!!shownDay} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShownDay(null)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={shownDay ? formatDate(lang, shownDay, DAY_LONG) : ""} onClose={() => setShownDay(null)} />
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
            {shown?.kind === "clash" ? <Problem text={c.entry.clash} /> : null}
            {shown?.items.map((e) => (
              <Card key={key(e)} style={{ gap: space.sm, borderLeftWidth: 4, borderLeftColor: calendarColors[e.kind] }}>
                <Text v="h3">
                  {e.kind === "booking"
                    ? f(c.entry.booking, { site: siteName(e.channel, e.label, t) })
                    : e.kind === "site"
                      ? f(c.entry.site, { site: siteName(e.channel, e.label, t) })
                      : e.kind === "block"
                        ? c.entry.block
                        : f(c.entry.request, { name: e.label })}
                </Text>
                <Text v="small" color={colors.ink}>
                  {formatRange(lang, e.start, e.end)}
                  {e.guests ? ` · ${t.p(m.guest.units.guests, e.guests)}` : ""}
                </Text>
                {e.note ? <Text v="small">{e.note}</Text> : null}
                {e.kind === "site" ? <Text v="small">{f(c.entry.siteNote, { site: siteName(e.channel, e.label, t) })}</Text> : null}
                {e.kind === "block" ? (
                  <Button kind="secondary" label={working ? c.entry.reopening : c.entry.reopen} busy={working} onPress={() => reopen(e.id)} style={{ alignSelf: "flex-start" }} />
                ) : null}
                {e.kind === "request" ? (
                  <Button
                    kind="secondary"
                    label={c.requests.openChat}
                    onPress={() => {
                      setShownDay(null);
                      router.push(`/thread/${e.id}`);
                    }}
                    style={{ alignSelf: "flex-start" }}
                  />
                ) : null}
              </Card>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  week: { flexDirection: "row", paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, marginBottom: space.xs },
  weekday: { width: `${100 / 7}%`, textAlign: "center", textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: "center", justifyContent: "center" },
  band: { position: "absolute", top: 8, bottom: 8, left: 0, right: 0 },
  picked: { position: "absolute", top: 6, bottom: 6, left: 2, right: 2, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.ink },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.lg },
  pickPanelWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pickPanel: {
    backgroundColor: colors.page,
    padding: space.xl,
    gap: space.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
});
