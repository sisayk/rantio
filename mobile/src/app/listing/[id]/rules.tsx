import { useLocalSearchParams } from "expo-router";

import type { ListingDetail } from "@/api";
import { num, numText, useEditor } from "@/state/listing";
import { useT } from "@/text/i18n";
import { EditorShell, Group, InlineField, ToggleRow } from "@/ui/editor";
import { Field } from "@/ui/form";
import { Text } from "@/ui/kit";

/** "16:00:00" → "16:00"; "1600" or "16.00" → "16:00" when saving. */
const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");
function toTime(v: string): string | null {
  const t = v.trim().replace(".", ":");
  if (!t) return null;
  if (/^\d{3,4}$/.test(t)) return `${t.slice(0, -2).padStart(2, "0")}:${t.slice(-2)}`;
  if (/^\d{1,2}$/.test(t)) return `${t.padStart(2, "0")}:00`;
  return /^\d:\d\d$/.test(t) ? `0${t}` : t;
}

const from = (d: ListingDetail) => ({
  check_in_from: hhmm(d.check_in_from),
  check_in_until: hhmm(d.check_in_until),
  check_out_by: hhmm(d.check_out_by),
  self_check_in: d.self_check_in,
  min_age: numText(d.min_age),
  pets_allowed: d.pets_allowed,
  smoking_allowed: d.smoking_allowed,
  events_allowed: d.events_allowed,
  quiet_hours: d.quiet_hours,
  house_rules: d.house_rules,
  waste_instructions: d.waste_instructions,
  sauna_instructions: d.sauna_instructions,
  fireplace_instructions: d.fireplace_instructions,
});
type Form = ReturnType<typeof from>;

const toFields = (f: Form) => ({
  ...f,
  check_in_from: toTime(f.check_in_from),
  check_in_until: toTime(f.check_in_until),
  check_out_by: toTime(f.check_out_by),
  min_age: num(f.min_age),
});

/** Check-in and check-out, what's allowed, and how the cottage works. */
export default function ListingRules() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m } = useT();
  const l = m.listings;
  const t = l.rules;
  const editor = useEditor(Number(id), from, toFields);
  const { form, set, errors } = editor;
  const bad = (k: string) => (errors[k] ? l.invalid : null);

  return (
    <EditorShell title={t.title} editor={editor}>
      {form ? (
        <>
          <Text v="small">{t.lead}</Text>
          <Group title={l.checklist.items.rules}>
            <InlineField label={t.checkInFrom} keyboard="numbers-and-punctuation" placeholder="16:00" value={form.check_in_from} onChange={(v) => set("check_in_from", v)} error={bad("check_in_from")} width={90} />
            <InlineField label={t.checkInUntil} keyboard="numbers-and-punctuation" placeholder="22:00" value={form.check_in_until} onChange={(v) => set("check_in_until", v)} error={bad("check_in_until")} width={90} />
            <InlineField label={t.checkOutBy} keyboard="numbers-and-punctuation" placeholder="12:00" value={form.check_out_by} onChange={(v) => set("check_out_by", v)} error={bad("check_out_by")} width={90} />
            <ToggleRow label={t.selfCheckIn} value={form.self_check_in} onChange={(v) => set("self_check_in", v)} />
          </Group>
          <Group title={l.nav.rules}>
            <ToggleRow label={t.pets} value={form.pets_allowed} onChange={(v) => set("pets_allowed", v)} />
            <ToggleRow label={t.smoking} value={form.smoking_allowed} onChange={(v) => set("smoking_allowed", v)} />
            <ToggleRow label={t.events} value={form.events_allowed} onChange={(v) => set("events_allowed", v)} />
            <InlineField label={t.minAge} hint={t.minAgeHint} keyboard="number-pad" value={form.min_age} onChange={(v) => set("min_age", v)} error={bad("min_age")} width={70} />
            <Field label={t.quiet} placeholder={t.quietPlaceholder} value={form.quiet_hours} maxLength={60} onChangeText={(v) => set("quiet_hours", v)} error={bad("quiet_hours")} />
          </Group>
          <Field label={t.waste} multiline placeholder={t.wastePlaceholder} value={form.waste_instructions} onChangeText={(v) => set("waste_instructions", v)} error={bad("waste_instructions")} />
          <Field label={t.sauna} multiline placeholder={t.saunaPlaceholder} value={form.sauna_instructions} onChangeText={(v) => set("sauna_instructions", v)} error={bad("sauna_instructions")} />
          <Field label={t.fireplace} multiline placeholder={t.fireplacePlaceholder} value={form.fireplace_instructions} onChangeText={(v) => set("fireplace_instructions", v)} error={bad("fireplace_instructions")} />
          <Field label={t.other} multiline placeholder={t.otherPlaceholder} value={form.house_rules} onChangeText={(v) => set("house_rules", v)} error={bad("house_rules")} />
        </>
      ) : null}
    </EditorShell>
  );
}
