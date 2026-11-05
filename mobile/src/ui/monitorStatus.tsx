// What the monitor screens share: the box's overall state, temperatures written the language's way,
// a status pill and the small reading tiles.
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { MonitorKind, MonitorLast, MonitorRow } from "@/api";
import { MONITOR } from "@/i18n/messages/monitor";
import { useT } from "@/text/i18n";
import { colors, radius, shadow, space } from "@/theme";
import { Icon, type IconName, Text } from "@/ui/kit";

export type MonitorState = "ok" | "alert" | "offline" | "waiting";

export function stateOf(d: MonitorRow): MonitorState {
  if (!d.last_seen_at) return "waiting";
  if (d.alerts.some((a) => a.kind !== "offline" && a.kind !== "arrival")) return "alert";
  if (!d.online) return "offline";
  return "ok";
}

const STATE_COLORS: Record<MonitorState, [string, string]> = {
  ok: [colors.greenTint, colors.green],
  alert: ["#fdecea", colors.error],
  offline: [colors.berryTint, "#8a5a12"],
  waiting: [colors.ground, colors.soft],
};

export const KIND_ICONS: Record<MonitorKind, IconName> = {
  frost: "snow-outline",
  leak: "water-outline",
  power: "flash-off-outline",
  sauna: "flame-outline",
  door: "enter-outline",
  battery: "battery-dead-outline",
  offline: "cloud-offline-outline",
  arrival: "thermometer-outline",
};

/** 21.5 → "21.5 °C" in English, "21,5 °C" elsewhere. */
export function useDegrees() {
  const { lang } = useT();
  return (n: number | null | undefined) => {
    if (n == null) return "–";
    const text = (Math.round(n * 10) / 10).toFixed(1);
    return `${lang === "en" ? text : text.replace(".", ",")} °C`;
  };
}

/** A time the language's way: 14.05 today, 4.11. 14.05 on another day (4 Nov 14:05 in English). */
export function useWhen() {
  const { lang } = useT();
  return (iso: string | null | undefined) => {
    if (!iso) return "–";
    const d = new Date(iso);
    const hm = `${String(d.getHours()).padStart(2, "0")}${lang === "en" ? ":" : "."}${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === new Date().toDateString()) return hm;
    if (lang === "en") return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${hm}`;
    return `${d.getDate()}.${d.getMonth() + 1}. ${hm}`;
  };
}

export function signalWord(dbm: number | null | undefined): "good" | "fair" | "weak" | null {
  if (dbm == null) return null;
  return dbm >= -100 ? "good" : dbm >= -110 ? "fair" : "weak";
}

export function StatePill({ state }: { state: MonitorState }) {
  const { lang } = useT();
  const [bg, fg] = STATE_COLORS[state];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text v="tiny" color={fg}>
        {MONITOR[lang].status[state]}
      </Text>
    </View>
  );
}

export function Tile({ icon, label, value, warn }: { icon: IconName; label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.tile, warn && { backgroundColor: "#fdecea" }]}>
      <Icon name={icon} size={20} color={warn ? colors.error : colors.green} />
      <Text v="tiny">{label}</Text>
      <Text v="h3" color={warn ? colors.error : undefined}>
        {value}
      </Text>
    </View>
  );
}

/** The readings as tiles: what the box has a sensor for. */
export function ReadingTiles({ last }: { last: MonitorLast }) {
  const { lang } = useT();
  const t = MONITOR[lang];
  const deg = useDegrees();
  const tiles: React.ReactNode[] = [];
  if (last.sauna != null) tiles.push(<Tile key="s" icon="flame-outline" label={t.sauna} value={deg(last.sauna)} warn={last.sauna >= 60} />);
  if (last.humidity != null) tiles.push(<Tile key="h" icon="water-outline" label={t.humidity} value={`${last.humidity} %`} />);
  if (last.leak != null) tiles.push(<Tile key="l" icon="rainy-outline" label={t.leak} value={last.leak ? t.wet : t.dry} warn={last.leak} />);
  if (last.door != null) tiles.push(<Tile key="d" icon="enter-outline" label={t.door} value={last.door ? t.open : t.closed} />);
  if (last.mains != null) tiles.push(<Tile key="p" icon={last.mains ? "flash-outline" : "flash-off-outline"} label={t.power} value={last.mains ? t.mains : t.onBattery} warn={!last.mains} />);
  if (last.battery != null) tiles.push(<Tile key="b" icon="battery-half-outline" label={t.battery} value={`${last.battery} %`} warn={last.battery <= 15} />);
  const sig = signalWord(last.signal);
  if (sig) tiles.push(<Tile key="g" icon="cellular-outline" label={t.signal} value={t.signalWords[sig]} warn={sig === "weak"} />);
  return <View style={styles.tiles}>{tiles}</View>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  card: { marginTop: space.xl, gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.page },
  line: { flexDirection: "row", alignItems: "center", gap: space.md },
  tile: { width: "31.5%", minWidth: 96, gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.ground },
});

/** Today: one line per box, so the host sees at a glance that the cottages are fine. */
export function MonitorStatusCard({ monitors }: { monitors: MonitorRow[] }) {
  const { lang } = useT();
  const t = MONITOR[lang];
  const router = useRouter();
  const deg = useDegrees();
  return (
    <Pressable onPress={() => router.push(monitors.length === 1 ? `/monitor/${monitors[0].id}` : "/monitor")} accessibilityRole="button" style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.9 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon name="hardware-chip-outline" size={20} color={colors.green} />
        <Text v="h3" style={{ flex: 1 }}>
          {t.title}
        </Text>
        <Icon name="chevron-forward" size={18} color={colors.faint} />
      </View>
      {monitors.map((d) => (
        <View key={d.id} style={styles.line}>
          <Text v="body" numberOfLines={1} style={{ flex: 1 }}>
            {d.cottage?.name ?? (d.name || d.serial)}
          </Text>
          <Text v="bodyMedium">{deg(d.last.temp)}</Text>
          <StatePill state={stateOf(d)} />
        </View>
      ))}
    </Pressable>
  );
}
