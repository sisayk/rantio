import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import type { ListingDetail } from "@/api";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { num, numText, useEditor } from "@/state/listing";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { EditorShell, Group, InlineField, moneyText, toMoney, ToggleRow } from "@/ui/editor";
import { Field, styles as formStyles } from "@/ui/form";
import { Button, Icon, Row, Text } from "@/ui/kit";

type SeasonText = { name: string; start: string; end: string; price: string };

const from = (d: ListingDetail) => ({
  price_per_night: moneyText(d.price_per_night),
  weekend_price: moneyText(d.weekend_price),
  smart_pricing: d.smart_pricing,
  smart_min_price: moneyText(d.smart_min_price),
  smart_max_price: moneyText(d.smart_max_price),
  min_nights: numText(d.min_nights),
  max_nights: numText(d.max_nights),
  cleaning_fee: moneyText(d.cleaning_fee),
  extra_guest_fee: moneyText(d.extra_guest_fee),
  extra_guest_from: numText(d.extra_guest_from),
  pet_fee: moneyText(d.pet_fee),
  security_deposit: moneyText(d.security_deposit),
  weekly_discount: numText(d.weekly_discount),
  monthly_discount: numText(d.monthly_discount),
  seasonal_prices: d.seasonal_prices.map((s) => ({ ...s, price: moneyText(s.price) })) as SeasonText[],
  taxes_note: d.taxes_note,
});
type Form = ReturnType<typeof from>;

const toFields = (f: Form) => ({
  ...f,
  price_per_night: toMoney(f.price_per_night) ?? "0.00",
  weekend_price: toMoney(f.weekend_price),
  smart_min_price: toMoney(f.smart_min_price),
  smart_max_price: toMoney(f.smart_max_price),
  min_nights: num(f.min_nights) ?? 1,
  max_nights: num(f.max_nights),
  cleaning_fee: toMoney(f.cleaning_fee) ?? "0.00",
  extra_guest_fee: toMoney(f.extra_guest_fee) ?? "0.00",
  extra_guest_from: num(f.extra_guest_from),
  pet_fee: toMoney(f.pet_fee) ?? "0.00",
  security_deposit: toMoney(f.security_deposit) ?? "0.00",
  weekly_discount: num(f.weekly_discount) ?? 0,
  monthly_discount: num(f.monthly_discount) ?? 0,
  seasonal_prices: f.seasonal_prices.map((s) => ({ ...s, price: toMoney(s.price) ?? "0.00" })),
});

/** Prices are rounded like smart pricing rounds them: whole euros, tens of kronor, hundreds of krónur. */
const STEP: Record<string, number> = { SEK: 10, NOK: 10, DKK: 10, ISK: 100 };
const roundFor = (cur: string, v: number) => Math.max(STEP[cur] ?? 1, Math.round(v / (STEP[cur] ?? 1)) * (STEP[cur] ?? 1));

/** "06-19" ↔ month and day inputs. */
function DayInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { m } = useT();
  const [mm = "", dd = ""] = value.split("-");
  const part = (v: string, a11y: string, apply: (x: string) => string) => (
    <TextInput
      value={v}
      onChangeText={(x) => onChange(apply(x.replace(/\D/g, "").slice(0, 2)))}
      keyboardType="number-pad"
      maxLength={2}
      placeholder={a11y === m.listings.pricing.month ? "MM" : "DD"}
      placeholderTextColor={colors.faint}
      accessibilityLabel={`${label}: ${a11y}`}
      style={[formStyles.input, { width: 52, textAlign: "center", paddingHorizontal: 4 }]}
    />
  );
  return (
    <View style={{ gap: 4 }}>
      <Text v="tiny">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {part(dd, m.listings.pricing.day, (x) => `${mm}-${x}`)}
        <Text v="body">.</Text>
        {part(mm, m.listings.pricing.month, (x) => `${x}-${dd}`)}
        <Text v="body">.</Text>
      </View>
    </View>
  );
}

/** Nightly price, weekend price, smart pricing, fees, discounts and seasons. */
export default function ListingPricing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, lang, f: fill } = useT();
  const router = useRouter();
  const l = m.listings;
  const t = l.pricing;
  const editor = useEditor(pk, from, toFields);
  const { form, set, errors, listing } = editor;
  const bad = (k: string) => (errors[k] ? (k === "smart_max_price" || k === "non_field_errors" ? `${l.invalid}: ${errors[k]}` : l.invalid) : null);

  if (!form || !listing) return <EditorShell title={t.title} editor={editor} />;

  const cur = (isCurrency(listing.currency) ? listing.currency : "EUR") as Currency;
  const money = (v: number) => formatPrice(lang, v, cur);
  const base = Number(toMoney(form.price_per_night) ?? 0) || 0;
  const setSeason = (i: number, patch: Partial<SeasonText>) =>
    set(
      "seasonal_prices",
      form.seasonal_prices.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  return (
    <EditorShell title={t.title} editor={editor}>
      <Text v="small">{t.lead}</Text>

      <Group title={t.base}>
        <InlineField label={t.base} value={form.price_per_night} onChange={(v) => set("price_per_night", v)} suffix={cur} error={bad("price_per_night")} />
        <InlineField label={t.weekend} hint={t.weekendHint} value={form.weekend_price} onChange={(v) => set("weekend_price", v)} suffix={cur} error={bad("weekend_price")} />
      </Group>

      <Group title={t.smart} lead={t.smartLead}>
        <ToggleRow label={t.smartOn} value={form.smart_pricing} onChange={(v) => set("smart_pricing", v)} />
        {form.smart_pricing ? (
          <>
            <InlineField
              label={t.smartMin}
              hint={base ? fill(t.smartDefault, { price: money(roundFor(cur, base * 0.75)) }) : undefined}
              value={form.smart_min_price}
              onChange={(v) => set("smart_min_price", v)}
              suffix={cur}
              error={bad("smart_min_price")}
            />
            <InlineField
              label={t.smartMax}
              hint={base ? fill(t.smartDefault, { price: money(roundFor(cur, base * 2)) }) : undefined}
              value={form.smart_max_price}
              onChange={(v) => set("smart_max_price", v)}
              suffix={cur}
              error={bad("smart_max_price")}
            />
            <Text v="tiny">{t.smartSites}</Text>
          </>
        ) : null}
        <View style={styles.card}>
          <Row
            icon="calendar-outline"
            label={m.app.listing.calendarPrices}
            detail={l.nightPrices.lead}
            onPress={() => router.push({ pathname: "/calendar", params: { cottage: String(pk) } })}
            last
          />
        </View>
      </Group>

      <Group title={t.stay}>
        <InlineField label={t.minNights} keyboard="number-pad" value={form.min_nights} onChange={(v) => set("min_nights", v)} error={bad("min_nights")} width={80} />
        <InlineField label={t.maxNights} keyboard="number-pad" value={form.max_nights} onChange={(v) => set("max_nights", v)} error={bad("max_nights")} width={80} />
      </Group>

      <Group title={t.fees}>
        <InlineField label={t.cleaning} value={form.cleaning_fee} onChange={(v) => set("cleaning_fee", v)} suffix={cur} error={bad("cleaning_fee")} />
        <InlineField label={t.extraGuest} value={form.extra_guest_fee} onChange={(v) => set("extra_guest_fee", v)} suffix={cur} error={bad("extra_guest_fee")} />
        <InlineField label={t.extraGuestFrom} keyboard="number-pad" value={form.extra_guest_from} onChange={(v) => set("extra_guest_from", v)} error={bad("extra_guest_from")} width={80} />
        <InlineField label={t.pet} value={form.pet_fee} onChange={(v) => set("pet_fee", v)} suffix={cur} error={bad("pet_fee")} />
        <InlineField label={t.deposit} value={form.security_deposit} onChange={(v) => set("security_deposit", v)} suffix={cur} error={bad("security_deposit")} />
      </Group>

      <Group title={t.discounts}>
        <InlineField label={t.weekly} keyboard="number-pad" value={form.weekly_discount} onChange={(v) => set("weekly_discount", v)} error={bad("weekly_discount")} width={80} />
        <InlineField label={t.monthly} keyboard="number-pad" value={form.monthly_discount} onChange={(v) => set("monthly_discount", v)} error={bad("monthly_discount")} width={80} />
      </Group>

      <Group title={t.seasons} lead={t.seasonsLead}>
        {form.seasonal_prices.map((s, i) => (
          <View key={i} style={styles.season}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label={t.seasonName} value={s.name} placeholder={t.seasonNamePlaceholder} maxLength={60} onChangeText={(v) => setSeason(i, { name: v })} />
              </View>
              <Pressable
                onPress={() =>
                  set(
                    "seasonal_prices",
                    form.seasonal_prices.filter((_, j) => j !== i),
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={t.removeSeason}
                style={styles.remove}
              >
                <Icon name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.lg, flexWrap: "wrap" }}>
              <DayInput label={t.from} value={s.start} onChange={(v) => setSeason(i, { start: v })} />
              <DayInput label={t.to} value={s.end} onChange={(v) => setSeason(i, { end: v })} />
              <View style={{ gap: 4 }}>
                <Text v="tiny">{`${t.seasonPrice} (${cur})`}</Text>
                <TextInput
                  value={s.price}
                  onChangeText={(v) => setSeason(i, { price: v })}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t.seasonPrice}
                  style={[formStyles.input, { width: 100, textAlign: "right" }]}
                />
              </View>
            </View>
          </View>
        ))}
        {bad("seasonal_prices") ? (
          <Text v="small" color={colors.error}>
            {`${l.invalid}: ${errors.seasonal_prices}`}
          </Text>
        ) : null}
        <Button
          kind="secondary"
          icon="add"
          label={t.addSeason}
          onPress={() => set("seasonal_prices", [...form.seasonal_prices, { name: "", start: "06-19", end: "06-26", price: form.price_per_night || "0" }])}
          style={{ alignSelf: "flex-start" }}
        />
      </Group>

      <Field label={t.taxes} multiline value={form.taxes_note} placeholder={t.taxesPlaceholder} maxLength={500} onChangeText={(v) => set("taxes_note", v)} style={{ minHeight: 80 }} />
    </EditorShell>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: "#fff", overflow: "hidden" },
  season: { gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  remove: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
});
