// A country field like Airbnb's "Country/region": it looks like a text field and opens a searchable list.
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";

import { ACCOUNT } from "@/i18n/messages/account";
import { NAMES } from "@/text/names";
import { useT } from "@/text/i18n";
import { colors, fonts, radius, space } from "@/theme";
import { Icon, tap, Text } from "@/ui/kit";
import { styles as fieldStyles } from "@/ui/form";
import { SheetBar } from "@/ui/screen";

/** Rantio's own countries come first; everything else follows in the language's alphabetical order. */
const COVERED = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"];

export function CountryField({ label, value, onChange, error }: { label: string; value: string; onChange: (code: string) => void; error?: string | null }) {
  const { lang, country } = useT();
  const s = ACCOUNT[lang].settings;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = useMemo(() => {
    const names = NAMES[lang].country as Record<string, string>;
    const rest = Object.keys(names)
      .filter((c) => !COVERED.includes(c))
      .sort((a, b) => names[a].localeCompare(names[b], lang));
    return [...COVERED, ...rest].map((code) => ({ code, name: names[code] ?? code }));
  }, [lang]);

  const q = query.trim().toLocaleLowerCase(lang);
  // Names that start with the search come first ("eth" → Ethiopia before Netherlands).
  const shown = q
    ? all
        .filter((c) => c.name.toLocaleLowerCase(lang).includes(q) || c.code.toLowerCase() === q)
        .sort((a, b) => Number(!a.name.toLocaleLowerCase(lang).startsWith(q)) - Number(!b.name.toLocaleLowerCase(lang).startsWith(q)))
    : all;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ gap: 6 }}>
      <Text v="smallMedium">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? country(value) : s.chooseCountry}`}
        style={({ pressed }) => [fieldStyles.input, styles.box, error ? { borderColor: colors.error } : null, pressed && { backgroundColor: colors.ground }]}
      >
        <Text v="body" color={value ? colors.ink : colors.faint} style={{ flex: 1 }} numberOfLines={1}>
          {value ? country(value) : s.chooseCountry}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.soft} />
      </Pressable>
      {error ? (
        <Text v="small" color={colors.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={label} onClose={close} />
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.soft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={s.searchCountry}
              placeholderTextColor={colors.faint}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={styles.searchInput}
              accessibilityLabel={s.searchCountry}
            />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}
            renderItem={({ item, index }) => {
              const on = item.code === value;
              // A line between Rantio's countries and the rest (only when not searching).
              const gap = !q && index === COVERED.length;
              return (
                <Pressable
                  onPress={() => {
                    tap();
                    onChange(item.code);
                    close();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.item, gap && styles.gap, pressed && { opacity: 0.6 }]}
                >
                  <Text v={on ? "bodyMedium" : "body"} style={{ flex: 1 }}>
                    {item.name}
                  </Text>
                  {on ? <Icon name="checkmark" size={20} color={colors.green} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 50 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ground,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  gap: { borderTopWidth: 6, borderTopColor: colors.ground, marginTop: 0 },
});
