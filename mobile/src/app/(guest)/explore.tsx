import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, type Category, type Listing, LISTINGS } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { activeFilters, BEDROOM_CHOICES, COUNTRIES, type Filters, NO_FILTERS, search, type Sort } from "@/state/search";
import { daysBetween, formatRange } from "@/text/dates";
import { type T, useT } from "@/text/i18n";
import { colors, fonts, radius, shadow, shadowFloat, space, textSize } from "@/theme";
import { Chip, Stepper } from "@/ui/controls";
import { Button, Card, Empty, Icon, IconButton, Logo, tap, Text } from "@/ui/kit";
import { CATEGORY_EMOJI, ListingCard } from "@/ui/listing";
import { RangeCalendar } from "@/ui/range-calendar";
import { ModalFoot, SheetBar } from "@/ui/screen";

type Stay = { start: string | null; end: string | null; adults: number; children: number };
const NO_STAY: Stay = { start: null, end: null, adults: 0, children: 0 };

type Section = { key: string; title: string; listings: Listing[]; query: string };

/** Rows on the home screen: regions with several cottages, then countries, then the rest. */
function sections(t: T): Section[] {
  const out: Section[] = [];
  let left = [...LISTINGS];
  const byRegion = new Map<string, Listing[]>();
  for (const l of left) byRegion.set(`${l.country}:${l.region}`, [...(byRegion.get(`${l.country}:${l.region}`) ?? []), l]);
  for (const [k, ls] of [...byRegion].sort((a, b) => b[1].length - a[1].length)) {
    if (ls.length < 2) continue;
    const r = PLACES[ls[0].country]?.find((x) => x.id === ls[0].region);
    const place = r ? regionLabel(r, ls[0].country, t.lang) : ls[0].city;
    out.push({ key: k, title: t.f(t.m.app.explore.sectionIn, { place }), listings: ls, query: place });
    left = left.filter((l) => !ls.includes(l));
  }
  for (const c of COUNTRIES) {
    const ls = left.filter((l) => l.country === c);
    if (ls.length < 2) continue;
    out.push({ key: c, title: t.f(t.m.app.explore.sectionIn, { place: t.country(c) }), listings: ls, query: t.country(c) });
    left = left.filter((l) => !ls.includes(l));
  }
  if (left.length) out.push({ key: "more", title: t.m.app.explore.more, listings: left, query: "" });
  return out;
}

export default function Explore() {
  const t = useT();
  const { m, p, lang } = t;
  const { rates, homeView, setHomeView, setMode } = usePrefs();
  const { signedIn, owner } = useSession();
  const isHost = signedIn && !!owner?.is_host;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [stay, setStay] = useState<Stay>(NO_STAY);
  const [searching, setSearching] = useState(false);
  const [panel, setPanel] = useState(false);
  const results = useMemo(() => search(f, m.listingNames, rates), [f, m.listingNames, rates]);
  const rows = useMemo(() => sections(t), [t]);
  // The large-photo view shows every cottage, in the same order as the rows.
  const everything = useMemo(() => rows.flatMap((s) => s.listings), [rows]);
  const nights = stay.start && stay.end ? daysBetween(stay.start, stay.end) : 0;
  const browsing = !f.query && f.category === "all" && !activeFilters(f) && !nights;
  const asRows = browsing && homeView === "rows";
  const columns = width >= 700 ? 2 : 1;
  const cardWidth = (width - space.xl * 2 - (columns - 1) * space.lg) / columns;
  const compactWidth = Math.min(220, Math.round((width - space.xl) * 0.44));

  const summary = [
    f.query || null,
    stay.start && stay.end ? formatRange(lang, stay.start, stay.end) : null,
    f.guests ? p(m.guest.units.guests, f.guests) : null,
  ].filter(Boolean);

  const clear = () => {
    setF(NO_FILTERS);
    setStay(NO_STAY);
  };

  const header = (
    <View style={{ backgroundColor: colors.page }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.searchRow}>
          <Pressable
            onPress={() => {
              tap();
              setSearching(true);
            }}
            style={({ pressed }) => [styles.searchPill, pressed && { transform: [{ scale: 0.99 }] }]}
            accessibilityRole="search"
            accessibilityLabel={m.app.explore.start}
          >
            <Icon name="search" size={20} />
            <View style={{ alignItems: "center", flexShrink: 1 }}>
              <Text v="bodyMedium" numberOfLines={1}>
                {summary.length ? summary[0] : m.app.explore.start}
              </Text>
              {summary.length > 1 ? (
                <Text v="tiny" numberOfLines={1}>
                  {summary.slice(1).join(" · ")}
                </Text>
              ) : null}
            </View>
          </Pressable>
          {!browsing ? (
            <Pressable onPress={() => setPanel(true)} style={styles.roundButton} accessibilityRole="button" accessibilityLabel={m.guest.filters.filters}>
              <Icon name="options-outline" size={20} />
              {activeFilters(f) ? (
                <View style={styles.count}>
                  <Text v="tiny" color="#fff">
                    {activeFilters(f)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {CATEGORIES.map((c: Category) => {
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
              <Text style={{ fontSize: 20, lineHeight: 26 }}>{CATEGORY_EMOJI[c]}</Text>
              <Text v="smallMedium" color={on ? colors.ink : colors.soft} numberOfLines={1}>
                {m.guest.categories[c]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.resultsHead}>
        <Text v="h3">{p(m.guest.units.cottages, browsing ? LISTINGS.length : results.length)}</Text>
        {browsing ? (
          <View style={styles.viewSwitch} accessibilityRole="radiogroup">
            {(
              [
                ["rows", "grid-outline", m.app.explore.viewRows],
                ["list", "image-outline", m.app.explore.viewList],
              ] as const
            ).map(([v, icon, label]) => {
              const on = homeView === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => {
                    tap();
                    setHomeView(v);
                  }}
                  style={[styles.viewButton, on && styles.viewButtonOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                  hitSlop={4}
                >
                  <Icon name={icon} size={20} color={on ? "#fff" : colors.soft} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Button small kind="ghost" label={m.guest.filterPanel.clearAll} onPress={clear} />
        )}
      </View>
    </View>
  );

  const hostBand = (
    <>
      <Card style={styles.hostBand}>
        <Logo size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text v="h3">{m.guest.hostBand.title}</Text>
          <Text v="small">{m.guest.hostBand.body}</Text>
        </View>
      </Card>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl, marginTop: space.md }}>
        {isHost ? (
          <Button
            small
            label={m.app.profile.switchToHosting}
            onPress={() => {
              setMode("hosting");
              router.replace("/today");
            }}
          />
        ) : (
          <Button small label={m.guest.hostBand.cta} onPress={() => router.push("/list-cottage")} />
        )}
        {/* Signed in already: no Sign in button (it would ask again). */}
        {signedIn ? null : <Button small kind="secondary" label={m.app.explore.logIn} onPress={() => router.push("/login")} />}
      </View>
      <Text v="tiny" style={{ textAlign: "center", paddingHorizontal: space.xl, marginTop: space.xl }}>
        {m.guest.examples}
      </Text>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {asRows ? (
        <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
          {header}
          {rows.map((s, i) => (
            <View key={s.key} style={{ marginTop: i ? space.xl : space.sm }}>
              <View style={styles.sectionHead}>
                <Text v="h2" style={{ flex: 1 }} numberOfLines={1}>
                  {s.title}
                </Text>
                {s.query ? (
                  <IconButton name="arrow-forward" label={s.title} onPress={() => setF((c) => ({ ...c, query: s.query }))} size={18} />
                ) : null}
              </View>
              <FlatList
                horizontal
                data={s.listings}
                keyExtractor={(l) => l.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
                renderItem={({ item }) => <ListingCard listing={item} width={compactWidth} compact />}
              />
            </View>
          ))}
          {hostBand}
        </ScrollView>
      ) : (
        <FlatList
          key={columns}
          data={browsing ? everything : results}
          numColumns={columns}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          columnWrapperStyle={columns > 1 ? { gap: space.lg, paddingHorizontal: space.xl } : undefined}
          contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
          renderItem={({ item }) => (
            <View style={columns === 1 ? { paddingHorizontal: space.xl } : null}>
              <ListingCard listing={item} width={cardWidth} nights={nights} />
            </View>
          )}
          ListFooterComponent={browsing ? hostBand : undefined}
          ListEmptyComponent={<Empty icon="search-outline" title={m.guest.empty.title} action={<Button kind="secondary" label={m.guest.empty.action} onPress={clear} />} />}
          keyboardDismissMode="on-drag"
        />
      )}

      <SearchSheet
        visible={searching}
        value={{ query: f.query, stay }}
        onClose={() => setSearching(false)}
        onSearch={(query, s) => {
          setF((c) => ({ ...c, query, guests: s.adults + s.children }));
          setStay(s);
          setSearching(false);
        }}
      />
      <FilterPanel visible={panel} value={f} onClose={() => setPanel(false)} onChange={setF} />
    </View>
  );
}

/** "Where? When? Who?", one card open at a time, as in Airbnb's search. */
function SearchSheet({
  visible,
  value,
  onClose,
  onSearch,
}: {
  visible: boolean;
  value: { query: string; stay: Stay };
  onClose: () => void;
  onSearch: (query: string, stay: Stay) => void;
}) {
  const t = useT();
  const { m, p, lang, country } = t;
  const e = m.app.explore;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"where" | "when" | "who">("where");
  const [query, setQuery] = useState(value.query);
  const [stay, setStay] = useState<Stay>(value.stay);

  const destinations = useMemo(() => {
    const seen = new Map<string, { label: string; sub: string; emoji: string; n: number }>();
    for (const l of LISTINGS) {
      const r = PLACES[l.country]?.find((x) => x.id === l.region);
      const label = r ? regionLabel(r, l.country, lang) : l.city;
      const k = `${l.country}:${l.region}`;
      const cur = seen.get(k);
      seen.set(k, { label, sub: country(l.country), emoji: CATEGORY_EMOJI[l.badge], n: (cur?.n ?? 0) + 1 });
    }
    const q = query.trim().toLowerCase();
    return [...seen.values()]
      .filter((d) => !q || `${d.label} ${d.sub}`.toLowerCase().includes(q))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [lang, country, query]);

  const guests = stay.adults + stay.children;
  const dates = stay.start && stay.end ? formatRange(lang, stay.start, stay.end) : m.guest.datePicker.addDates;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => {
        setQuery(value.query);
        setStay(value.stay);
        setStep("where");
      }}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.ground, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <IconButton name="close" label={m.guest.contact.close} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
          {step === "where" ? (
            <View style={[styles.sheetCard, shadowFloat]}>
              <Text v="title">{e.where}</Text>
              <View style={styles.destInput}>
                <Icon name="search" size={20} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={e.searchDest}
                  placeholderTextColor={colors.soft}
                  style={styles.destText}
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => setStep("when")}
                />
                {query ? (
                  <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel={e.clear}>
                    <Icon name="close-circle" size={20} color={colors.faint} />
                  </Pressable>
                ) : null}
              </View>
              <Text v="smallMedium" style={{ marginTop: space.sm }}>
                {e.suggested}
              </Text>
              {destinations.map((d) => (
                <Pressable
                  key={`${d.label}-${d.sub}`}
                  onPress={() => {
                    tap();
                    setQuery(d.label);
                    setStep("when");
                  }}
                  style={({ pressed }) => [styles.dest, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.destIcon}>
                    <Text style={{ fontSize: 26, lineHeight: 32 }}>{d.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text v="bodyMedium">
                      {d.label}, {d.sub}
                    </Text>
                    <Text v="small">{p(m.guest.units.cottages, d.n)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Collapsed label={e.where.replace("?", "")} value={query || m.app.explore.all} onPress={() => setStep("where")} />
          )}

          {step === "when" ? (
            <View style={[styles.sheetCard, shadowFloat]}>
              <Text v="title">{m.guest.datePicker.title}</Text>
              {stay.start ? (
                <Button
                  small
                  kind="ghost"
                  label={m.guest.datePicker.clear}
                  onPress={() => setStay((s) => ({ ...s, start: null, end: null }))}
                  style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                />
              ) : null}
              <RangeCalendar
                lang={lang}
                start={stay.start}
                end={stay.end}
                onChange={(a, b) => {
                  setStay((s) => ({ ...s, start: a, end: b }));
                  // Both dates picked: on to the guests, as in Airbnb's search.
                  if (a && b) setTimeout(() => setStep("who"), 350);
                }}
                months={12}
              />
            </View>
          ) : (
            <Collapsed label={e.when} value={dates} onPress={() => setStep("when")} />
          )}

          {step === "who" ? (
            <View style={[styles.sheetCard, shadowFloat]}>
              <Text v="title">{e.who}</Text>
              <View style={styles.whoRow}>
                <Text v="bodyMedium">{m.guest.guestPicker.adults}</Text>
                <Stepper value={stay.adults} max={16} onChange={(adults) => setStay((s) => ({ ...s, adults }))} label={m.guest.guestPicker.adults} />
              </View>
              <View style={[styles.whoRow, { borderBottomWidth: 0 }]}>
                <Text v="bodyMedium">{m.guest.guestPicker.children}</Text>
                <Stepper value={stay.children} max={10} onChange={(children) => setStay((s) => ({ ...s, children }))} label={m.guest.guestPicker.children} />
              </View>
            </View>
          ) : (
            <Collapsed label={e.who} value={guests ? p(m.guest.units.guests, guests) : m.guest.search.guestsPlaceholder} onPress={() => setStep("who")} />
          )}
        </ScrollView>
        <View style={styles.sheetFoot}>
          <Button
            kind="ghost"
            label={m.guest.filterPanel.clearAll}
            onPress={() => {
              setQuery("");
              setStay(NO_STAY);
              setStep("where");
            }}
          />
          {/* Where → When → Who, then Search: the guests are asked before the cottages are listed. */}
          {step === "who" ? (
            <Button icon="search" label={m.guest.search.button} onPress={() => onSearch(query.trim(), stay)} />
          ) : (
            <Button label={m.app.common.next} onPress={() => setStep(step === "where" ? "when" : "who")} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Collapsed({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.collapsed, shadow]} accessibilityRole="button">
      <Text v="body" color={colors.soft}>
        {label}
      </Text>
      <Text v="bodyMedium" numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </Pressable>
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
        <ModalFoot style={styles.panelFoot}>
          <Button kind="ghost" label={m.guest.filterPanel.clearAll} onPress={() => setF({ ...NO_FILTERS, query: f.query, category: f.category })} />
          <Button
            label={m.guest.filterPanel.show.replace("{cottages}", p(m.guest.units.cottages, shown))}
            onPress={() => {
              onChange(f);
              onClose();
            }}
          />
        </ModalFoot>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  searchPill: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadowFloat,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  count: { position: "absolute", top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  categories: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow,
  },
  categoryOn: { backgroundColor: colors.ground, borderColor: colors.faint },
  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    marginBottom: space.md,
  },
  viewSwitch: { flexDirection: "row", gap: 2, padding: 3, borderRadius: radius.pill, backgroundColor: colors.ground },
  viewButton: { width: 40, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  viewButtonOn: { backgroundColor: colors.ink },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xl, marginBottom: space.md },
  hostBand: { flexDirection: "row", gap: space.lg, alignItems: "center", marginHorizontal: space.xl, marginTop: space.xxl },
  sheetCard: { backgroundColor: "#fff", borderRadius: 28, padding: space.xl, gap: space.md },
  destInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 56,
  },
  destText: { flex: 1, fontFamily: fonts.regular, fontSize: textSize(17), color: colors.ink, paddingVertical: 0 },
  dest: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: 6 },
  destIcon: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.ground, alignItems: "center", justifyContent: "center" },
  collapsed: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.lg,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: space.xl,
    height: 64,
  },
  whoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sheetFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    backgroundColor: colors.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
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
