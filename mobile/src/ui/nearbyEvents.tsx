// Events near the cottage during the guest's stay, as on the website's cottage page
// (frontend/src/components/guest/NearbyEvents.tsx): the same /api/events/ answer and texts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { API_URL } from "@/api";
import { fill, number } from "@/i18n/format";
import { LANG_INFO } from "@/i18n/locales";
import { EVENTS } from "@/i18n/messages/events";
import { formatPrice, isCurrency } from "@/lib/currency";
import { useT } from "@/text/i18n";
import { formatRange } from "@/text/dates";
import { colors, radius, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { Button, Icon, Text } from "@/ui/kit";

type Interest = keyof (typeof EVENTS)["en"]["interests"];
type EventItem = {
  id: string;
  source: string;
  name: string;
  start: string;
  end: string | null;
  all_day: boolean;
  venue: string;
  km: number;
  description: string;
  url: string;
  price: { free: boolean | null; text: string; min: number | null; max: number | null; currency: string };
  interests: Interest[];
};
type Answer = { events: EventItem[]; sources: string[]; covered: boolean };
type State = { status: "loading" } | { status: "error" } | { status: "ready"; answer: Answer };

const SAVED_KEY = "rantio.savedEvents.v1";
const FIRST = 5; // shown before "Show all"
// Times show in the cottage's own time, wherever the guest is.
const ZONES: Record<string, string> = {
  FI: "Europe/Helsinki", SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  IS: "Atlantic/Reykjavik", EE: "Europe/Tallinn", LV: "Europe/Riga", LT: "Europe/Vilnius",
};

/** Give it key={from + to}: new dates start afresh (loading, all interests). */
export function NearbyEvents({ lat, lng, country, from, to, onAddDates }: { lat: number; lng: number; country: string; from: string | null; to: string | null; onAddDates: () => void }) {
  const { lang, m } = useT();
  const t = EVENTS[lang];
  const [state, setState] = useState<State>({ status: "loading" });
  const [interest, setInterest] = useState<Interest | "all" | "saved">("all");
  const [all, setAll] = useState(false);
  const [saved, setSaved] = useState<Record<string, EventItem>>({});

  useEffect(() => {
    AsyncStorage.getItem(SAVED_KEY)
      .then((s) => s && setSaved(JSON.parse(s) as Record<string, EventItem>))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    const ac = new AbortController();
    const q = new URLSearchParams({ lat: lat.toFixed(4), lng: lng.toFixed(4), from, to, lang });
    fetch(`${API_URL}/api/events/?${q}`, { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Answer>) : Promise.reject(new Error(String(r.status)))))
      .then((answer) => setState({ status: "ready", answer }))
      .catch(() => !ac.signal.aborted && setState({ status: "error" }));
    return () => ac.abort();
  }, [lat, lng, from, to, lang]);

  const fmt = useMemo(() => {
    const intl = LANG_INFO[lang].intl;
    const timeZone = ZONES[country] ?? "Europe/Helsinki";
    return {
      day: new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone }),
      time: new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", timeZone }),
      short: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone }),
      dayKey: new Intl.DateTimeFormat("en-CA", { timeZone }),
    };
  }, [lang, country]);

  const toggleSave = (ev: EventItem) =>
    setSaved((now) => {
      const next = { ...now };
      if (next[ev.id]) delete next[ev.id];
      else next[ev.id] = ev;
      AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });

  // No dates yet: ask for them before suggesting anything.
  if (!from || !to) {
    return (
      <View style={styles.card}>
        <Text v="small">{t.askDates}</Text>
        <Button small kind="secondary" icon="calendar-outline" label={m.guest.datePicker.addDates} onPress={onAddDates} style={{ alignSelf: "flex-start" }} />
      </View>
    );
  }
  const stay = formatRange(lang, from, to);
  const changeDates = (
    <Pressable onPress={onAddDates} accessibilityRole="button" hitSlop={8}>
      <Text v="smallMedium" color={colors.green}>
        {t.changeDates}
      </Text>
    </Pressable>
  );
  if (state.status === "loading") return <Text v="small">{t.loading}</Text>;
  if (state.status === "error") return <Text v="small">{t.error}</Text>;

  const events = state.answer.events;
  if (!events.length) {
    return (
      <View style={{ gap: space.xs }}>
        <Text v="small">
          {t.none} <Text v="smallMedium">{stay}</Text>
        </Text>
        {changeDates}
      </View>
    );
  }

  const km = (n: number) => (n < 1 ? `${Math.max(100, Math.round(n * 10) * 100)} m` : `${number(lang, n, { max: n < 10 ? 1 : 0 })} km`);
  const when = (ev: EventItem) => {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : null;
    if (end && fmt.dayKey.format(end) !== fmt.dayKey.format(start)) return `${fmt.day.format(start)} – ${fill(lang, t.until, { date: fmt.short.format(end) })}`;
    return `${fmt.day.format(start)} · ${ev.all_day ? t.allDay : fmt.time.format(start)}`;
  };
  const price = (ev: EventItem): { free: boolean; text: string } | null => {
    const p = ev.price;
    if (p.free) return { free: true, text: t.free };
    if (p.min !== null && p.min > 0) {
      const amount = isCurrency(p.currency) ? formatPrice(lang, p.min, p.currency) : `${number(lang, p.min)} ${p.currency}`;
      return { free: false, text: fill(lang, t.from, { price: amount }) };
    }
    if (p.text) return { free: false, text: `${t.paid} · ${p.text}` };
    if (p.free === false) return { free: false, text: t.paid };
    return null;
  };

  const present = (Object.keys(t.interests) as Interest[]).filter((k) => events.some((e) => e.interests.includes(k)));
  const savedCount = events.filter((e) => saved[e.id]).length;
  const matching = events.filter((e) => (interest === "all" ? true : interest === "saved" ? saved[e.id] : e.interests.includes(interest)));
  const shown = all ? matching : matching.slice(0, FIRST);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Text v="small" style={{ flex: 1 }}>
          {stay}
        </Text>
        {changeDates}
      </View>
      {present.length > 1 || savedCount ? (
        <View style={styles.chips}>
          {(["all", ...present] as const).map((k) => (
            <Chip key={k} label={k === "all" ? t.all : t.interests[k]} on={interest === k} onPress={() => (setInterest(k), setAll(false))} />
          ))}
          {savedCount ? <Chip label={fill(lang, t.savedOnly, { n: String(savedCount) })} on={interest === "saved"} onPress={() => (setInterest("saved"), setAll(false))} /> : null}
        </View>
      ) : null}
      {shown.map((ev) => {
        const cost = price(ev);
        const isSaved = Boolean(saved[ev.id]);
        return (
          <View key={ev.id} style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text v="tiny" color={colors.green}>
                {when(ev)}
              </Text>
              <Text v="h3">{ev.name}</Text>
              <Text v="small" numberOfLines={1}>
                {[ev.venue, fill(lang, t.away, { distance: km(ev.km) })].filter(Boolean).join(" · ")}
              </Text>
              {ev.description ? (
                <Text v="small" numberOfLines={3} color={colors.soft}>
                  {ev.description}
                </Text>
              ) : null}
              <View style={styles.foot}>
                {cost ? (
                  <View style={[styles.price, cost.free && { backgroundColor: colors.greenTint }]}>
                    <Text v="tiny" color={cost.free ? colors.green : undefined}>
                      {cost.text}
                    </Text>
                  </View>
                ) : null}
                <Pressable onPress={() => Linking.openURL(ev.url)} accessibilityRole="link" hitSlop={6} style={styles.link}>
                  <Text v="smallMedium" color={colors.green}>
                    {t.tickets}
                  </Text>
                  <Icon name="open-outline" size={14} color={colors.green} />
                </Pressable>
              </View>
            </View>
            <Pressable onPress={() => toggleSave(ev)} accessibilityRole="button" accessibilityState={{ selected: isSaved }} accessibilityLabel={`${isSaved ? t.saved : t.save}: ${ev.name}`} hitSlop={8}>
              <Icon name={isSaved ? "heart" : "heart-outline"} size={22} color={isSaved ? colors.berry : colors.soft} />
            </Pressable>
          </View>
        );
      })}
      {matching.length > FIRST ? (
        <Button kind="secondary" label={all ? t.hide : `${t.explore} (${matching.length})`} onPress={() => setAll(!all)} />
      ) : null}
      <Text v="tiny">{fill(lang, t.source, { sources: state.answer.sources.join(", ") })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.ground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  foot: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.md, marginTop: space.xs },
  price: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.ground },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
});
