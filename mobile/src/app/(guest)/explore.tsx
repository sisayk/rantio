import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CATEGORIES, HERO_PHOTO } from "@/lib/listings";
import { usePrefs } from "@/state/prefs";
import { activeFilters, BEDROOM_CHOICES, COUNTRIES, type Filters, NO_FILTERS, search, type Sort } from "@/state/search";
import { useT } from "@/text/i18n";
import { colors, fonts, radius, shadow, space } from "@/theme";
import { Button, Empty, Icon, Logo, tap, Text } from "@/ui/kit";
import { Chip, Stepper } from "@/ui/controls";
import { CATEGORY_ICONS, ListingCard } from "@/ui/listing";
import { SheetBar } from "@/ui/screen";

export default function Explore() {
  const { m, p, country } = useT();
  const { rates } = usePrefs();
  const { width } = useWindowDimensions();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [panel, setPanel] = useState(false);
  const results = useMemo(() => search(f, m.listingNames, rates), [f, m.listingNames, rates]);
  const columns = width >= 700 ? 2 : 1;
  const cardWidth = (width - space.xl * 2 - (columns - 1) * space.lg) / columns;
  const count = activeFilters(f);

  const header = (
    <View>
      <View style={styles.hero}>
        <Image source={HERO_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroShade} />
        <SafeAreaView edges={["top"]} style={{ paddingHorizontal: space.xl, paddingBottom: space.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
            <Logo size={30} color="#fff" />
            <Text v="h2" color="#fff" style={{ fontFamily: fonts.bold, letterSpacing: -0.6 }}>
              Stugora
            </Text>
          </View>
          <Text v="title" color="#fff" style={{ marginTop: space.xl, maxWidth: 420 }}>
            {m.guest.hero.title}
          </Text>
          <Text v="body" color="rgba(255,255,255,0.92)" style={{ marginTop: space.xs }}>
            {m.guest.hero.lead}
          </Text>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Icon name="search" size={20} />
              <TextInput
                value={f.query}
                onChangeText={(query) => setF((c) => ({ ...c, query }))}
                placeholder={m.app.explore.search}
                placeholderTextColor={colors.soft}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel={m.guest.search.where}
              />
              {f.query ? (
                <Pressable onPress={() => setF((c) => ({ ...c, query: "" }))} hitSlop={10} accessibilityLabel={m.app.explore.clear}>
                  <Icon name="close-circle" size={20} color={colors.faint} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                tap();
                setPanel(true);
              }}
              style={styles.filterButton}
              accessibilityRole="button"
              accessibilityLabel={m.guest.filters.filters}
            >
              <Icon name="options-outline" size={22} />
              {count ? (
                <View style={styles.filterCount}>
                  <Text v="tiny" color="#fff">
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {CATEGORIES.map((c) => {
          const on = f.category === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                tap();
                setF((cur) => ({ ...cur, category: c }));
              }}
              style={[styles.category, on && styles.categoryOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Icon name={CATEGORY_ICONS[c]} size={22} color={on ? colors.ink : colors.soft} />
              <Text v="tiny" color={on ? colors.ink : colors.soft} numberOfLines={1}>
                {m.guest.categories[c]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text v="small" style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md }}>
        {p(m.guest.units.cottages, results.length)}
        {f.country ? ` · ${country(f.country)}` : ""}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FlatList
        key={columns}
        data={results}
        numColumns={columns}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={header}
        columnWrapperStyle={columns > 1 ? { gap: space.lg, paddingHorizontal: space.xl } : undefined}
        contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
        renderItem={({ item }) => (
          <View style={columns === 1 ? { paddingHorizontal: space.xl } : null}>
            <ListingCard listing={item} width={cardWidth} />
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="search-outline"
            title={m.guest.empty.title}
            action={<Button kind="secondary" label={m.guest.empty.action} onPress={() => setF(NO_FILTERS)} />}
          />
        }
        ListFooterComponent={
          results.length ? (
            <Text v="tiny" style={{ textAlign: "center", paddingHorizontal: space.xl }}>
              {m.guest.examples}
            </Text>
          ) : undefined
        }
        keyboardDismissMode="on-drag"
      />
      <FilterPanel visible={panel} value={f} onClose={() => setPanel(false)} onChange={setF} />
    </View>
  );
}

function FilterPanel({ visible, value, onClose, onChange }: { visible: boolean; value: Filters; onClose: () => void; onChange: (f: Filters) => void }) {
  const { m, p, country } = useT();
  const { rates } = usePrefs();
  const [f, setF] = useState(value);
  const shown = useMemo(() => search(f, m.listingNames, rates).length, [f, m.listingNames, rates]);
  const set = (patch: Partial<Filters>) => setF((c) => ({ ...c, ...patch }));
  const sorts = m.guest.filters.sorts as Record<Sort, string>;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={() => setF(value)} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SheetBar title={m.guest.filterPanel.title} onClose={onClose} />
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
          <View style={{ gap: space.md }}>
            <Text v="h2">{m.guest.filters.location}</Text>
            <View style={styles.wrap}>
              <Chip label={m.app.explore.all} on={!f.country} onPress={() => set({ country: null })} />
              {COUNTRIES.map((c) => (
                <Chip key={c} label={country(c)} on={f.country === c} onPress={() => set({ country: f.country === c ? null : c })} />
              ))}
            </View>
          </View>
          <View style={styles.line} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text v="h2">{m.guest.filters.guests}</Text>
            <Stepper value={f.guests} max={16} onChange={(guests) => set({ guests })} label={m.guest.filters.guests} />
          </View>
          <View style={styles.line} />
          <View style={{ gap: space.md }}>
            <Text v="h2">{m.guest.filterPanel.bedrooms}</Text>
            <View style={styles.wrap}>
              <Chip label={m.app.explore.all} on={!f.bedrooms} onPress={() => set({ bedrooms: 0 })} />
              {BEDROOM_CHOICES.map((b) => (
                <Chip key={b} label={b >= 4 ? "4+" : String(b)} on={f.bedrooms === b} onPress={() => set({ bedrooms: b })} />
              ))}
            </View>
          </View>
          <View style={styles.line} />
          <View style={{ gap: space.md }}>
            <Text v="h2">{m.catalog.groups.booking}</Text>
            <View style={styles.wrap}>
              <Chip label={m.guest.filters.instantBook} on={f.instantBook} onPress={() => set({ instantBook: !f.instantBook })} />
              <Chip label={m.guest.filters.freeCancellation} on={f.freeCancellation} onPress={() => set({ freeCancellation: !f.freeCancellation })} />
            </View>
          </View>
          <View style={styles.line} />
          <View style={{ gap: space.md }}>
            <Text v="h2">{m.guest.filters.sortBy}</Text>
            <View style={styles.wrap}>
              {(Object.keys(sorts) as Sort[]).map((s) => (
                <Chip key={s} label={sorts[s]} on={f.sort === s} onPress={() => set({ sort: s })} />
              ))}
            </View>
          </View>
        </ScrollView>
        <SafeAreaView edges={["bottom"]} style={styles.panelFoot}>
          <Button kind="ghost" label={m.guest.filterPanel.clearAll} onPress={() => setF({ ...NO_FILTERS, query: f.query, category: f.category })} />
          <Button
            label={m.guest.filterPanel.show.replace("{cottages}", p(m.guest.units.cottages, shown))}
            onPress={() => {
              onChange(f);
              onClose();
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", backgroundColor: colors.greenDeep },
  heroShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10, 30, 24, 0.38)" },
  searchRow: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 52,
    ...shadow,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: 0 },
  filterButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow },
  filterCount: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  categories: { paddingHorizontal: space.lg, gap: space.xs, paddingTop: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  category: { alignItems: "center", gap: 4, paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.xs, borderBottomWidth: 2, borderBottomColor: "transparent", minWidth: 64 },
  categoryOn: { borderBottomColor: colors.ink },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  panelFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
