import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { type Currency, formatPrice } from "@/lib/currency";
import { useHost } from "@/state/host";
import { formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { Figure, SiteIcon } from "@/ui/host";
import { Button, Card, Loading, Problem, Section, Text } from "@/ui/kit";
import { TabScreen } from "@/ui/screen";

export default function Earnings() {
  const { m, lang, f, p, n } = useT();
  const d = m.dashboard;
  const { summary: s, error, loading, refresh, setYear } = useHost();
  const router = useRouter();

  if (!s) {
    return (
      <TabScreen title={m.app.tabs.earnings}>{error ? <Problem text={d.error} retry={refresh} retryLabel={d.retry} /> : <Loading />}</TabScreen>
    );
  }

  const cur = s.currency as Currency;
  const money = (v: string | number, c: Currency = cur) => formatPrice(lang, Number(v), c);
  const cents = (v: string | number, c: Currency = cur) => formatPrice(lang, Number(v), c, true);
  const max = Math.max(1, ...s.months.map((x) => Number(x.stugora) + Number(x.own)));
  const rate = n(Number(s.owner.commission_rate)); // a percentage, e.g. "12.00"

  return (
    <TabScreen title={m.app.tabs.earnings} refreshing={loading} onRefresh={refresh}>
      {s.years.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginBottom: space.lg }}>
          {s.years.map((y) => (
            <Chip key={y} label={String(y)} on={y === s.year} onPress={() => setYear(y)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.figures}>
        <Figure label={d.kpi.payout} value={money(s.totals.payout)} sub={f(d.kpi.payoutSub, { stugora: money(s.totals.payout_stugora), own: money(s.totals.payout_own) })} />
        <Figure label={d.kpi.net} value={money(s.totals.net)} sub={d.kpi.netSub} tone="green" />
        <Figure label={d.kpi.bookings} value={String(s.totals.bookings)} sub={s.totals.cancelled ? p(d.kpi.cancelled, s.totals.cancelled) : p(d.nights, s.totals.nights)} />
        <Figure label={d.kpi.stugora} value={money(s.totals.stugora_total)} sub={f(d.kpi.stugoraSub, { rate })} />
      </View>

      <Section title={d.chart.title}>
        <Text v="small" style={{ marginBottom: space.lg }}>
          {d.chart.lead}
        </Text>
        <View style={styles.chart} accessibilityLabel={d.chart.title}>
          {s.months.map((x) => {
            const st = Number(x.stugora);
            const own = Number(x.own);
            return (
              <View key={x.month} style={styles.col} accessible accessibilityLabel={`${formatDate(lang, `${s.year}-${String(x.month).padStart(2, "0")}-01`, { month: "long" })}: ${money(st + own)}`}>
                <View style={styles.barArea}>
                  <View style={{ height: `${(st / max) * 100}%`, backgroundColor: colors.green, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                  <View style={{ height: `${(own / max) * 100}%`, backgroundColor: colors.berry, borderTopLeftRadius: st ? 0 : 4, borderTopRightRadius: st ? 0 : 4 }} />
                </View>
                <Text v="tiny" style={{ textAlign: "center" }}>
                  {formatDate(lang, `${s.year}-${String(x.month).padStart(2, "0")}-01`, { month: "narrow" })}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: space.lg, marginTop: space.md, flexWrap: "wrap" }}>
          <Legend color={colors.green} label={d.chart.stugora} />
          <Legend color={colors.berry} label={`${d.chart.own} (${d.chart.ownNote})`} />
        </View>
      </Section>

      <Section title={d.sites.title}>
        {s.channels.length === 0 ? (
          <Text v="small">{d.sites.empty}</Text>
        ) : (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {s.channels.map((c, i) => (
              <View key={c.channel} style={[styles.siteRow, i < s.channels.length - 1 && styles.line]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <SiteIcon channel={c.channel} label={c.label} />
                  <Text v="small">
                    {c.bookings} {d.sites.bookings.toLowerCase()} · {p(d.nights, c.nights)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text v="h3">{money(c.payout)}</Text>
                  <Text v="tiny">{c.charged ? `${d.sites.commission} ${cents(c.commission)}` : d.sites.free}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
        <Button kind="secondary" label={m.app.menu.bookings} icon="list-outline" onPress={() => router.push("/bookings")} style={{ marginTop: space.md }} />
      </Section>

      <Section title={d.fees.title}>
        {s.fees.length === 0 ? (
          <Text v="small">{d.fees.empty}</Text>
        ) : (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {s.fees.map((fee, i) => (
              <View key={`${fee.cottage}-${fee.listing_year}`} style={[styles.siteRow, i < s.fees.length - 1 && styles.line]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text v="h3">{fee.cottage}</Text>
                  <Text v="small">{f(d.fees.line, { n: fee.listing_year, date: formatDate(lang, fee.starts_on, { day: "numeric", month: "short", year: "numeric" }) })}</Text>
                </View>
                {Number(fee.fee) === 0 ? (
                  <Text v="smallMedium" color={colors.green}>
                    {d.fees.free}
                  </Text>
                ) : (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text v="h3">{cents(fee.fee, "EUR")}</Text>
                    <Text v="tiny">{f(d.fees.plusVat, { vat: cents(fee.vat, "EUR") })}</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
        <Text v="small" style={{ marginTop: space.lg }}>
          {d.howItWorks}
        </Text>
      </Section>
    </TabScreen>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
    <Text v="tiny" style={{ flexShrink: 1 }}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  figures: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 170, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  col: { flex: 1, height: "100%", justifyContent: "flex-end", gap: 4 },
  barArea: { flex: 1, justifyContent: "flex-end", borderRadius: radius.sm, overflow: "hidden" },
  siteRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
