import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { type BookingRow, ownerApi } from "@/api";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { useHost } from "@/state/host";
import { formatRange } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { SiteIcon } from "@/ui/host";
import { Empty, Loading, Pill, Problem, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";

/** Every booking of a year, as in the website's statement. */
export default function Bookings() {
  const { m, lang, p, f } = useT();
  const st = m.dashboard.statement;
  const { summary } = useHost();
  const [year, setYear] = useState(summary?.year ?? new Date().getFullYear());
  const [loaded, setLoaded] = useState<{ year: number; rows: BookingRow[] | null }>({ year: 0, rows: null });

  useEffect(() => {
    let live = true;
    ownerApi
      .bookings(year)
      .then((r) => live && setLoaded({ year, rows: r.results }))
      .catch(() => live && setLoaded({ year, rows: null }));
    return () => {
      live = false;
    };
  }, [year]);

  const rows = loaded.year === year ? loaded.rows : null;
  const failed = loaded.year === year && loaded.rows === null;

  const money = (v: string, c: string, cents = false) => formatPrice(lang, Number(v), (isCurrency(c) ? c : "EUR") as Currency, cents);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={f(st.title, { year })} />
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }}>
        {summary && summary.years.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginBottom: space.lg }}>
            {summary.years.map((y) => (
              <Chip key={y} label={String(y)} on={y === year} onPress={() => setYear(y)} />
            ))}
          </ScrollView>
        ) : null}
        {failed ? (
          <Problem text={m.dashboard.error} />
        ) : rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon="calendar-clear-outline" title={st.empty} />
        ) : (
          rows.map((b) => (
            <View key={b.id} style={[styles.row, b.cancelled && { opacity: 0.55 }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text v="h3">{formatRange(lang, b.check_in, b.check_out)}</Text>
                <Text v="small">
                  {b.cottage} · {p(m.dashboard.nights, b.nights)} · {p(m.guest.units.guests, b.guests)}
                </Text>
                <SiteIcon channel={b.channel} label={b.channel_label} size={14} />
                {b.cancelled ? <Pill label={st.cancelled} tone="error" /> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text v="h3">{money(b.payout, b.currency)}</Text>
                <Text v="tiny">{b.charged ? `${st.commission} ${money(b.commission, b.currency, true)}` : m.dashboard.sites.free}</Text>
                {b.charged ? <Text v="tiny">{`${st.vat} ${money(b.commission_vat, b.currency, true)}`}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
