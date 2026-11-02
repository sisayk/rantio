// Pieces the hosting screens share: a booking site's icon and name, a stay row, a figure.
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { BookingRow } from "@/api";
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import { DAY_WEEKDAY, daysBetween, formatDate } from "@/text/dates";
import { type T, useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Logo, Pill, Text } from "@/ui/kit";

export function siteName(channel: string, label: string, t: T) {
  const known = channel in CHANNELS ? (channel as ChannelId) : null;
  return known ? CHANNELS[known].name : channel === "owner" ? t.m.dashboard.ownBooking : channel === "direct" ? "Rantio" : label;
}

export function SiteIcon({ channel, label, showName = true, size = 18 }: { channel: string; label: string; showName?: boolean; size?: number }) {
  const t = useT();
  const known = channel in CHANNELS ? (channel as ChannelId) : null;
  const name = siteName(channel, label, t);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={[styles.icon, { width: size + 6, height: size + 6 }]}>
        {known ? (
          <Image source={{ uri: channelIcon(known) }} style={{ width: size, height: size, borderRadius: 4 }} />
        ) : channel === "direct" ? (
          <Logo size={size} />
        ) : (
          <Text v="tiny" color={colors.green}>
            {name.charAt(0)}
          </Text>
        )}
      </View>
      {showName ? (
        <Text v="smallMedium" numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

/** When a stay starts, the way the website's dashboard says it. */
export function stayWhen(b: Pick<BookingRow, "check_in" | "staying_now">, today: string, t: T): string {
  const u = t.m.dashboard.upcoming;
  if (b.staying_now) return u.now;
  const d = daysBetween(today, b.check_in);
  if (d === 0) return u.today;
  if (d === 1) return u.tomorrow;
  return t.p(u.inDays, d);
}

export function StayRow({ b, today, last }: { b: BookingRow; today: string; last?: boolean }) {
  const t = useT();
  const { m, lang, p } = t;
  return (
    <View style={[styles.stay, !last && styles.line]}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pill label={stayWhen(b, today, t)} tone={b.staying_now ? "green" : daysBetween(today, b.check_in) <= 1 ? "berry" : "neutral"} />
        </View>
        <Text v="h3" numberOfLines={1}>
          {b.cottage}
        </Text>
        <Text v="small">
          {formatDate(lang, b.check_in, DAY_WEEKDAY)} – {formatDate(lang, b.check_out, DAY_WEEKDAY)} · {p(m.dashboard.nights, b.nights)} · {p(m.guest.units.guests, b.guests)}
        </Text>
      </View>
      <SiteIcon channel={b.channel} label={b.channel_label} showName={false} size={20} />
    </View>
  );
}

export function Figure({ label, value, sub, tone = "ink" }: { label: string; value: string; sub?: string; tone?: "ink" | "green" }) {
  return (
    <View style={styles.figure}>
      <Text v="small">{label}</Text>
      <Text v="title" color={tone === "green" ? colors.green : colors.ink} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      {sub ? <Text v="tiny">{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { borderRadius: 6, backgroundColor: colors.ground, alignItems: "center", justifyContent: "center" },
  stay: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  figure: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.page,
    gap: 2,
  },
});
