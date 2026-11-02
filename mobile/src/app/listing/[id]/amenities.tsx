import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import type { ListingDetail } from "@/api";
import { AMENITY_GROUPS, amenityName } from "@/lib/amenities";
import { useEditor } from "@/state/listing";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { EditorShell, Group } from "@/ui/editor";
import { styles as formStyles } from "@/ui/form";
import { Icon, tap, Text } from "@/ui/kit";

const from = (d: ListingDetail) => ({ amenities: d.amenities });
type Form = ReturnType<typeof from>;
const toFields = (f: Form) => f;

/** Tick what the property has, by group, with a search. */
export default function ListingAmenities() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m, f: fill, p } = useT();
  const a = m.listings.amenities;
  const editor = useEditor(Number(id), from, toFields);
  const { form, set } = editor;
  const [query, setQuery] = useState("");
  const name = (key: string) => amenityName(key, m.catalog.features, a.names);
  const q = query.trim().toLowerCase();

  const toggle = (key: string) => {
    if (!form) return;
    tap();
    set("amenities", form.amenities.includes(key) ? form.amenities.filter((x) => x !== key) : [...form.amenities, key]);
  };

  const groups = AMENITY_GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => !q || name(k).toLowerCase().includes(q)) })).filter((g) => g.keys.length);

  return (
    <EditorShell title={a.title} editor={editor}>
      {form ? (
        <>
          <Text v="small">{a.lead}</Text>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={a.search}
              placeholderTextColor={colors.faint}
              accessibilityLabel={a.search}
              style={[formStyles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
              clearButtonMode="while-editing"
            />
          </View>
          <Text v="smallMedium">{p(a.selected, form.amenities.length)}</Text>
          {groups.length === 0 ? <Text v="small">{fill(a.noMatch, { query })}</Text> : null}
          {groups.map((g) => (
            <Group key={g.id} title={a.groups[g.id as keyof typeof a.groups]}>
              {g.keys.map((k) => {
                const on = form.amenities.includes(k);
                return (
                  <Pressable
                    key={k}
                    onPress={() => toggle(k)}
                    style={styles.row}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={name(k)}
                  >
                    <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="checkmark" size={16} color="#fff" /> : null}</View>
                    <Text v="body" style={{ flex: 1 }}>
                      {name(k)}
                    </Text>
                  </Pressable>
                );
              })}
            </Group>
          ))}
        </>
      ) : null}
    </EditorShell>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 6 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
});
