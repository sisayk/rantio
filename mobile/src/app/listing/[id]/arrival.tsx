import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import type { ListingDetail } from "@/api";
import { useEditor } from "@/state/listing";
import { useT } from "@/text/i18n";
import { space } from "@/theme";
import { EditorShell } from "@/ui/editor";
import { Field } from "@/ui/form";
import { Icon, Text } from "@/ui/kit";

const from = (d: ListingDetail) => ({
  arrival_instructions: d.arrival_instructions,
  departure_instructions: d.departure_instructions,
  access_details: d.access_details,
});
type Form = ReturnType<typeof from>;
const toFields = (f: Form) => f;

/** What guests with a confirmed stay get: directions, leaving, codes. Never shown on the listing. */
export default function ListingArrival() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m } = useT();
  const l = m.listings;
  const t = l.arrival;
  const editor = useEditor(Number(id), from, toFields);
  const { form, set, errors } = editor;
  const bad = (k: string) => (errors[k] ? l.invalid : null);

  return (
    <EditorShell title={t.title} editor={editor}>
      {form ? (
        <>
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
            <Icon name="lock-closed-outline" size={18} />
            <Text v="small" style={{ flex: 1 }}>
              {t.lead}
            </Text>
          </View>
          <Field label={t.arrival} multiline placeholder={t.arrivalPlaceholder} value={form.arrival_instructions} onChangeText={(v) => set("arrival_instructions", v)} error={bad("arrival_instructions")} />
          <Field label={t.departure} multiline placeholder={t.departurePlaceholder} value={form.departure_instructions} onChangeText={(v) => set("departure_instructions", v)} error={bad("departure_instructions")} />
          <Field label={t.access} multiline placeholder={t.accessPlaceholder} value={form.access_details} onChangeText={(v) => set("access_details", v)} error={bad("access_details")} />
        </>
      ) : null}
    </EditorShell>
  );
}
