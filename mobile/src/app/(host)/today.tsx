import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Alert as Ask, Pressable, StyleSheet, View } from "react-native";

import { type ListingSummary, mediaUrl, ownerApi, SignedOut } from "@/api";
import { HOST_TODAY } from "@/i18n/messages/hostToday";
import type { Currency } from "@/lib/currency";
import { formatPrice } from "@/lib/currency";
import { useHost } from "@/state/host";
import { formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, shadow, space } from "@/theme";
import { Avatar, Card, Icon, type IconName, Loading, Pill, Problem, Text, Wordmark } from "@/ui/kit";
import { StayRow } from "@/ui/host";
import { MONITOR_PHOTO } from "@/ui/monitor";
import { TabScreen } from "@/ui/screen";

const STATUS_TONE = { intake: "berry", listing: "berry", live: "green", paused: "neutral", archived: "neutral" } as const;

export default function Today() {
  const { m, lang, f, p, country } = useT();
  const d = m.dashboard;
  const t = HOST_TODAY[lang];
  const { summary: s, conversations, unread: unreadAll, error, loading, refresh, setYear } = useHost();
  const router = useRouter();
  const [listings, setListings] = useState<ListingSummary[] | null>(null);
  const pending = (conversations ?? []).filter((c) => c.request_status === "pending" && !c.archived);
  const unread = (conversations ?? []).filter((c) => c.unread && !c.archived && c.request_status !== "pending").length;

  // Photos and what's missing come from the listings, so they're fresh after editing one.
  useFocusEffect(
    useCallback(() => {
      ownerApi
        .listings()
        .then((r) => setListings(r.cottages))
        .catch(() => undefined);
    }, []),
  );

  if (!s) {
    return (
      <TabScreen title={m.app.tabs.today}>
        {error && !(error instanceof SignedOut) ? <Problem text={d.error} retry={refresh} retryLabel={d.retry} /> : <Loading />}
      </TabScreen>
    );
  }

  const money = (v: string) => formatPrice(lang, Number(v), s.currency as Currency);
  const listing = (id: number) => listings?.find((x) => x.id === id);
  const unfinished = s.cottages.filter((c) => {
    const l = listing(c.id);
    return l ? l.missing.length > 0 : c.status === "intake";
  });

  const pickYear = () =>
    Ask.alert(t.earnings, undefined, [
      ...s.years.map((y) => ({ text: String(y), onPress: () => setYear(y) })),
      { text: m.app.common.cancel, style: "cancel" as const },
    ]);

  return (
    <TabScreen background={colors.ground} refreshing={loading} onRefresh={refresh}>
      <View style={styles.top}>
        <Wordmark height={26} />
        <Pill label={t.host} tone="green" style={styles.hostPill} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.navigate("/inbox")} accessibilityRole="button" accessibilityLabel={m.app.tabs.inbox} hitSlop={8}>
          <Icon name="notifications-outline" size={26} />
          {unreadAll > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable onPress={() => router.navigate("/menu")} accessibilityRole="button" accessibilityLabel={m.app.tabs.menu}>
          <Avatar name={s.owner.name} size={40} />
        </Pressable>
      </View>

      <Text v="display" accessibilityRole="header">
        {f(d.hello, { name: s.owner.first_name || s.owner.name })}
      </Text>
      <Text v="body" color={colors.soft}>
        {t.overview}
      </Text>
      <Text v="small" color={colors.faint} style={{ marginTop: 2 }}>
        {formatDate(lang, s.today, { weekday: "long", day: "numeric", month: "long" })}
      </Text>

      {error ? <Problem text={d.error} retry={refresh} retryLabel={d.retry} /> : null}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {unfinished.length ? (
          <Banner
            icon="clipboard-outline"
            title={t.setupTitle}
            lead={p(t.setupLead, unfinished.length)}
            action={t.setupAction}
            onPress={() => (unfinished.length === 1 ? router.push(`/listing/${unfinished[0].id}`) : router.push("/listings"))}
          />
        ) : null}
        {pending.length ? (
          <Alert
            icon="calendar-outline"
            tone="berry"
            text={p(m.app.today.requests, pending.length)}
            onPress={() => (pending.length === 1 ? router.push(`/thread/${pending[0].id}`) : router.navigate("/calendar"))}
          />
        ) : null}
        {unread ? <Alert icon="chatbubble-ellipses-outline" tone="green" text={p(m.app.today.unread, unread)} onPress={() => router.navigate("/inbox")} /> : null}
      </View>

      <Head title={d.upcoming.title} link={m.app.tabs.calendar} onLink={() => router.navigate("/calendar")} />
      {s.upcoming.length ? (
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          {s.upcoming.map((b, i) => (
            <StayRow key={b.id} b={b} today={s.today} last={i === s.upcoming.length - 1} />
          ))}
        </Card>
      ) : (
        <Card style={styles.emptyRow}>
          <IconTile icon="calendar-outline" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text v="h3">{t.noStays}</Text>
            <Text v="small">{t.noStaysLead}</Text>
          </View>
        </Card>
      )}

      <Head
        title={t.earnings}
        right={
          <Pressable onPress={pickYear} accessibilityRole="button" style={({ pressed }) => [styles.yearChip, pressed && { opacity: 0.7 }]}>
            <Text v="smallMedium">{s.year}</Text>
            <Icon name="chevron-down" size={16} />
          </Pressable>
        }
      />
      <Card>
        <Text v="display" color={colors.green} adjustsFontSizeToFit numberOfLines={1}>
          {money(s.totals.net)}
        </Text>
        <Text v="small">{d.kpi.net}</Text>
        <View style={styles.grid}>
          <Cell label={d.kpi.payout} value={money(s.totals.payout)} right bottom />
          <Cell label={d.kpi.bookings} value={String(s.totals.bookings)} bottom />
          <Cell label={t.nights} value={String(s.totals.nights)} right />
          <Cell label={t.fees} value={money(s.totals.stugora_total)} />
        </View>
        <Link label={m.app.today.seeEarnings} onPress={() => router.navigate("/earnings")} />
      </Card>

      <Head title={t.cottages} link={`+ ${t.add}`} onLink={() => router.push("/listings")} />
      {s.cottages.length === 0 ? <Text v="small">{d.calendar.empty}</Text> : null}
      <View style={{ gap: space.md }}>
        {s.cottages.map((c) => {
          const l = listing(c.id);
          const needs = unfinished.some((u) => u.id === c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/listing/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={c.name}
              style={({ pressed }) => [styles.cottage, shadow, pressed && { opacity: 0.85 }]}
            >
              {l?.cover ? (
                <Image source={{ uri: mediaUrl(l.cover) }} style={styles.thumb} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.thumb, styles.noThumb]}>
                  <Icon name="home-outline" size={28} color={colors.faint} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4, paddingVertical: space.md, paddingRight: space.md }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
                  <Text v="h3" numberOfLines={1} style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                  <Pill label={d.cottages.status[c.status]} tone={STATUS_TONE[c.status]} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="location-outline" size={14} color={colors.soft} />
                  <Text v="small" numberOfLines={1} style={{ flex: 1 }}>
                    {[c.municipality, country(c.country)].filter(Boolean).join(", ")}
                  </Text>
                </View>
                {needs ? (
                  <Text v="smallMedium" color={colors.green}>
                    {t.complete} →
                  </Text>
                ) : c.status === "live" ? (
                  <Text v="small" color={colors.ink}>
                    {p(d.cottages.nightsBooked, c.nights)}
                    {c.occupancy !== null ? ` · ${f(d.cottages.occupancy, { pct: Math.round(c.occupancy * 100) })}` : ""}
                  </Text>
                ) : (
                  <Text v="small" numberOfLines={2}>
                    {d.cottages.notLive}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.push("/monitor")} accessibilityRole="button" style={({ pressed }) => [styles.monitor, shadow, pressed && { opacity: 0.9 }]}>
        <View style={{ flex: 1, padding: space.lg, gap: space.sm }}>
          <Pill label={m.guest.hostBand.monitor.badge} tone="green" />
          <Text v="h3">{t.monitorTitle}</Text>
          <Text v="small">{m.guest.hostBand.monitor.title}</Text>
          <View style={styles.monitorButton}>
            <Text v="smallMedium" color="#fff">
              {m.guest.hostBand.monitor.link} →
            </Text>
          </View>
        </View>
        <Image source={MONITOR_PHOTO} style={styles.monitorPhoto} contentFit="cover" accessibilityElementsHidden />
      </Pressable>
    </TabScreen>
  );
}

function Head({ title, link, onLink, right }: { title: string; link?: string; onLink?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text v="h2" style={{ flex: 1 }}>
        {title}
      </Text>
      {right}
      {link && onLink ? <Link label={link} onPress={onLink} arrow={!link.startsWith("+")} /> : null}
    </View>
  );
}

function Link({ label, onPress, arrow = true }: { label: string; onPress: () => void; arrow?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text v="smallMedium" color={colors.green}>
        {label}
      </Text>
      {arrow ? <Icon name="arrow-forward" size={16} color={colors.green} /> : null}
    </Pressable>
  );
}

function IconTile({ icon }: { icon: IconName }) {
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={22} color={colors.green} />
    </View>
  );
}

function Cell({ label, value, right, bottom }: { label: string; value: string; right?: boolean; bottom?: boolean }) {
  return (
    <View style={[styles.cell, right && styles.cellRight, bottom && styles.cellBottom]}>
      <Text v="small">{label}</Text>
      <Text v="h2" adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Banner({ icon, title, lead, action, onPress }: { icon: IconName; title: string; lead: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}>
      <View style={[styles.tile, { backgroundColor: colors.berryTint }]}>
        <Icon name={icon} size={24} color="#8a5410" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text v="h3">{title}</Text>
        <Text v="small">{lead}</Text>
        <View style={[styles.link, { marginTop: space.xs }]}>
          <Text v="smallMedium" color={colors.green}>
            {action}
          </Text>
          <Icon name="arrow-forward" size={16} color={colors.green} />
        </View>
      </View>
    </Pressable>
  );
}

function Alert({ icon, text, tone, onPress }: { icon: IconName; text: string; tone: "berry" | "green"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.alert, { backgroundColor: tone === "berry" ? colors.berryTint : colors.greenTint }, pressed && { opacity: 0.8 }]}
    >
      <Icon name={icon} size={22} color={tone === "berry" ? "#8a5410" : colors.green} />
      <Text v="bodyMedium" style={{ flex: 1 }}>
        {text}
      </Text>
      <Icon name="chevron-forward" size={18} color={colors.soft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.md, paddingBottom: space.lg },
  hostPill: { alignSelf: "center", letterSpacing: 1, textTransform: "uppercase" },
  dot: { position: "absolute", top: 1, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart, borderWidth: 1.5, borderColor: colors.ground },
  head: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, marginBottom: space.md },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  tile: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  yearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.page,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: space.lg, marginBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  cell: { width: "50%", paddingVertical: space.md, paddingRight: space.md, gap: 2 },
  cellRight: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  cellBottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  banner: { flexDirection: "row", gap: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.greenTint },
  cottage: { flexDirection: "row", gap: space.md, borderRadius: radius.md, backgroundColor: colors.page, overflow: "hidden" },
  thumb: { width: 112, alignSelf: "stretch", minHeight: 96 },
  noThumb: { backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  monitor: { flexDirection: "row", marginTop: space.xl, borderRadius: radius.md, backgroundColor: colors.page, overflow: "hidden" },
  monitorPhoto: { width: 120, alignSelf: "stretch" },
  monitorButton: { alignSelf: "flex-start", marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.green },
  alert: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md },
});
