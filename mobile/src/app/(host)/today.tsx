import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { SignedOut } from "@/api";
import type { Currency } from "@/lib/currency";
import { formatPrice } from "@/lib/currency";
import { useHost } from "@/state/host";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Button, Card, Empty, Icon, type IconName, Loading, Pill, Problem, Section, Text } from "@/ui/kit";
import { Figure, StayRow } from "@/ui/host";
import { TabScreen } from "@/ui/screen";

const STATUS_TONE = { intake: "berry", listing: "berry", live: "green", paused: "neutral" } as const;

export default function Today() {
  const { m, lang, f, p, country } = useT();
  const d = m.dashboard;
  const { summary: s, conversations, error, loading, refresh } = useHost();
  const router = useRouter();
  const pending = (conversations ?? []).filter((c) => c.request_status === "pending" && !c.archived);
  const unread = (conversations ?? []).filter((c) => c.unread && !c.archived && c.request_status !== "pending").length;

  if (!s) {
    return (
      <TabScreen title={m.app.tabs.today}>
        {error && !(error instanceof SignedOut) ? <Problem text={d.error} retry={refresh} retryLabel={d.retry} /> : <Loading />}
      </TabScreen>
    );
  }

  const money = (v: string) => formatPrice(lang, Number(v), s.currency as Currency);

  return (
    <TabScreen title={f(d.hello, { name: s.owner.first_name || s.owner.name })} subtitle={d.lead} refreshing={loading} onRefresh={refresh}>
      {error ? <Problem text={d.error} retry={refresh} retryLabel={d.retry} /> : null}

      {pending.length || unread ? (
        <View style={{ gap: space.sm }}>
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
      ) : null}

      <Section title={d.upcoming.title}>
        {s.upcoming.length ? (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {s.upcoming.map((b, i) => (
              <StayRow key={b.id} b={b} today={s.today} last={i === s.upcoming.length - 1} />
            ))}
          </Card>
        ) : (
          <Empty icon="sunny-outline" title={d.upcoming.empty} />
        )}
      </Section>

      <Section title={`${m.app.today.thisYear} · ${s.year}`}>
        <View style={styles.figures}>
          <Figure label={d.kpi.payout} value={money(s.totals.payout)} />
          <Figure label={d.kpi.net} value={money(s.totals.net)} tone="green" />
          <Figure
            label={d.kpi.bookings}
            value={String(s.totals.bookings)}
            sub={s.totals.cancelled ? p(d.kpi.cancelled, s.totals.cancelled) : p(d.nights, s.totals.nights)}
          />
          <Figure label={d.kpi.stugora} value={money(s.totals.stugora_total)} />
        </View>
        <Button kind="secondary" label={m.app.today.seeEarnings} onPress={() => router.navigate("/earnings")} style={{ marginTop: space.md }} />
      </Section>

      <Section title={d.cottages.title}>
        {s.cottages.length === 0 ? <Text v="small">{d.calendar.empty}</Text> : null}
        {s.cottages.map((c) => (
          <Card key={c.id} style={{ marginBottom: space.md, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <Text v="h3" style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Pill label={d.cottages.status[c.status]} tone={STATUS_TONE[c.status]} />
            </View>
            <Text v="small">{[c.municipality, country(c.country)].filter(Boolean).join(", ")}</Text>
            {c.status === "live" ? (
              <Text v="small" color={colors.ink}>
                {p(d.cottages.nightsBooked, c.nights)}
                {c.occupancy !== null ? ` · ${f(d.cottages.occupancy, { pct: Math.round(c.occupancy * 100) })}` : ""}
              </Text>
            ) : (
              <Text v="small">{d.cottages.notLive}</Text>
            )}
          </Card>
        ))}
      </Section>
    </TabScreen>
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
  figures: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  alert: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md },
});
