import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { type ListingDetail, ownerApi } from "@/api";
import type { PropertyType } from "@/lib/ownerApi";
import { LANG_INFO, LANGS, type Lang } from "@/i18n/locales";
import { num, numText, useEditor } from "@/state/listing";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { EditorShell, Group, InlineField } from "@/ui/editor";
import { Field } from "@/ui/form";
import { Button, Icon, Text } from "@/ui/kit";

const TYPES: PropertyType[] = ["cottage", "cabin", "villa", "holiday_home", "apartment", "farmhouse", "other"];
const COUNTRIES = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"];

const from = (d: ListingDetail) => ({
  name: d.name,
  property_type: d.property_type,
  country: d.country,
  municipality: d.municipality,
  address: d.address,
  max_guests: numText(d.max_guests),
  bedrooms: numText(d.bedrooms),
  bathrooms: numText(d.bathrooms),
  beds: numText(d.beds),
  floor_area: numText(d.floor_area),
  floors: numText(d.floors),
  host_languages: d.host_languages,
  descriptions: d.descriptions,
});
type Form = ReturnType<typeof from>;

const toFields = (f: Form) => ({
  ...f,
  max_guests: num(f.max_guests) ?? 1,
  bedrooms: num(f.bedrooms) ?? 0,
  bathrooms: num(f.bathrooms) ?? 0,
  beds: num(f.beds) ?? 0,
  floor_area: num(f.floor_area),
  floors: num(f.floors) ?? 1,
});

/** Name, type, where it is, rooms, languages and the description in each language. */
export default function ListingBasics() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m, lang, f: fill, country } = useT();
  const l = m.listings;
  const b = l.basics;
  const editor = useEditor(Number(id), from, toFields);
  const { form, set, errors, listing, refresh } = editor;
  const [descLang, setDescLang] = useState<Lang>(lang);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const bad = (k: string) => (errors[k] ? l.invalid : null);

  // AI translates the description after a save: fetch the listing until every language is in.
  const tr = listing?.translation;
  const translating = (tr?.pending.length ?? 0) > 0;
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (!translating) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await ownerApi.listing(Number(id));
        if (stopped) return;
        refreshRef.current(next);
        if (!next.translation.pending.length) return;
      } catch {
        /* offline for a moment: try again */
      }
      if (!stopped) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [translating, id]);

  const auto = listing?.descriptions_auto ?? {};
  const kept = listing?.descriptions ?? {};
  const pending = new Set(tr?.pending ?? []);
  const failed = tr?.failed ?? [];
  // A language counts as AI-translated while it still holds the translation as saved.
  const isAuto = (code: string) => Boolean(auto[code]) && (form?.descriptions[code] ?? "") === (kept[code] ?? "");
  const own = LANGS.filter((c) => kept[c]?.trim() && !auto[c]);
  const descriptionsChanged = Boolean(form) && JSON.stringify(form?.descriptions) !== JSON.stringify(kept);
  const canStart = Boolean(tr?.enabled) && own.length > 0 && !descriptionsChanged;
  const missing = LANGS.some((c) => !kept[c]?.trim());
  const langName = (c: string) => LANG_INFO[c as Lang]?.native ?? c;

  const translateNow = async () => {
    setStarting(true);
    setStartFailed(false);
    try {
      refresh(await ownerApi.translateListing(Number(id), own.includes(descLang) ? descLang : undefined));
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  };

  return (
    <EditorShell title={b.title} editor={editor}>
      {form ? (
        <>
          <Field label={b.name} value={form.name} onChangeText={(v) => set("name", v)} maxLength={120} error={bad("name")} />

          <Group title={b.type}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {TYPES.map((t) => (
                <Chip key={t} label={l.types[t]} on={form.property_type === t} onPress={() => set("property_type", t)} />
              ))}
            </View>
          </Group>

          <Group title={b.country}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {COUNTRIES.map((c) => (
                <Chip key={c} label={country(c)} on={form.country === c} onPress={() => set("country", c)} />
              ))}
            </View>
            <Field label={b.municipality} value={form.municipality} onChangeText={(v) => set("municipality", v)} maxLength={80} error={bad("municipality")} />
            <Field label={b.address} hint={b.addressHint} value={form.address} onChangeText={(v) => set("address", v)} maxLength={200} error={bad("address")} />
          </Group>

          <Group title={l.nav.basics}>
            <InlineField label={b.guests} keyboard="number-pad" value={form.max_guests} onChange={(v) => set("max_guests", v)} error={bad("max_guests")} width={80} />
            <InlineField label={b.bedrooms} keyboard="number-pad" value={form.bedrooms} onChange={(v) => set("bedrooms", v)} error={bad("bedrooms")} width={80} />
            <InlineField label={b.bathrooms} keyboard="number-pad" value={form.bathrooms} onChange={(v) => set("bathrooms", v)} error={bad("bathrooms")} width={80} />
            <InlineField label={b.beds} keyboard="number-pad" value={form.beds} onChange={(v) => set("beds", v)} error={bad("beds")} width={80} />
            <InlineField label={b.area} keyboard="number-pad" value={form.floor_area} onChange={(v) => set("floor_area", v)} error={bad("floor_area")} width={80} />
            <InlineField label={b.floors} keyboard="number-pad" value={form.floors} onChange={(v) => set("floors", v)} error={bad("floors")} width={80} />
          </Group>

          <Group title={b.languages}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {LANGS.map((code) => {
                const on = form.host_languages.includes(code);
                return (
                  <Chip
                    key={code}
                    label={LANG_INFO[code].native}
                    on={on}
                    onPress={() => set("host_languages", on ? form.host_languages.filter((x) => x !== code) : [...form.host_languages, code])}
                  />
                );
              })}
            </View>
          </Group>

          <Group title={b.descriptions} lead={tr?.enabled ? b.ai.lead : b.descriptionsLead}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {LANGS.map((code) => {
                const mark = pending.has(code) ? " …" : isAuto(code) ? ` · ${b.ai.badge}` : form.descriptions[code]?.trim() ? " ✓" : "";
                return <Chip key={code} label={`${LANG_INFO[code].native}${mark}`} on={descLang === code} onPress={() => setDescLang(code)} />;
              })}
            </View>
            {translating ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.berry} />
                <Text v="small" style={{ flex: 1 }}>
                  {b.ai.working}
                </Text>
              </View>
            ) : failed.length ? (
              <View style={{ gap: space.sm }}>
                <Text v="small">{fill(b.ai.failed, { langs: failed.map(langName).join(", ") })}</Text>
                {canStart ? <Button kind="secondary" small icon="refresh" label={b.ai.retry} busy={starting} onPress={() => void translateNow()} style={{ alignSelf: "flex-start" }} /> : null}
              </View>
            ) : canStart && missing ? (
              <Button kind="secondary" small icon="sparkles" label={b.ai.fill} busy={starting} onPress={() => void translateNow()} style={{ alignSelf: "flex-start" }} />
            ) : null}
            {startFailed ? (
              <Text v="small" color={colors.error}>
                {b.ai.error}
              </Text>
            ) : null}
            {isAuto(descLang) ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: space.sm,
                  padding: space.md,
                  borderRadius: radius.sm,
                  backgroundColor: colors.berryTint,
                }}
              >
                <Icon name="sparkles" size={16} color={colors.berry} />
                <Text v="small" color={colors.ink} style={{ flex: 1 }}>
                  {fill(b.ai.note, { from: langName(auto[descLang]) })}
                </Text>
              </View>
            ) : null}
            <Field
              label={fill(m.app.listing.descriptionIn, { language: LANG_INFO[descLang].native })}
              multiline
              maxLength={5000}
              placeholder={b.descriptionPlaceholder}
              value={form.descriptions[descLang] ?? ""}
              onChangeText={(v) => set("descriptions", { ...form.descriptions, [descLang]: v })}
              error={bad("descriptions")}
              style={{ minHeight: 200 }}
            />
            <Text v="tiny" color={colors.faint}>
              {fill(b.chars, { n: (form.descriptions[descLang] ?? "").length, max: 5000 })}
            </Text>
          </Group>
        </>
      ) : null}
    </EditorShell>
  );
}
