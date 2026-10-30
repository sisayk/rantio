import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, type Category, getListing, listingCurrency, listingName, LISTINGS, unsplash } from "@/lib/listings";
import { useMoney } from "@/state/money";
import { useT } from "@/text/i18n";
import { colors, radius, shadow, shadowFloat, space } from "@/theme";
import { ChannelStack } from "@/ui/channels";
import { IconButton, tap, Text } from "@/ui/kit";
import { CATEGORY_EMOJI, HeartButton } from "@/ui/listing";
import { CottagesMap } from "@/ui/maps";

/** Every cottage on a map, with its price, as on Airbnb's map. */
export default function MapTab() {
  const { m, p, country } = useT();
  const money = useMoney();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<Category>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const listings = useMemo(() => LISTINGS.filter((l) => category === "all" || l.categories.includes(category)), [category]);
  const l = selected ? getListing(selected) : undefined;
  const price = l ? money.show(l.price, listingCurrency(l)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.greenTint }}>
      <CottagesMap listings={listings} selected={selected} onSelect={setSelected} topPadding={insets.top + 60} bottomPadding={l ? 170 : 20} />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}>
          {CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  tap();
                  setCategory(c);
                  setSelected(null);
                }}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={{ fontSize: 17, lineHeight: 22 }}>{CATEGORY_EMOJI[c]}</Text>
                <Text v="smallMedium" color={on ? "#fff" : colors.ink}>
                  {m.guest.categories[c]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.count}>
          <Text v="smallMedium">{p(m.guest.units.cottages, listings.length)}</Text>
        </View>
      </View>

      {l && price ? (
        <View style={[styles.cardWrap, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <Pressable onPress={() => router.push(`/cottage/${l.id}`)} style={[styles.card, shadowFloat]} accessibilityRole="link">
            <View>
              <Image source={{ uri: unsplash(l.photo, 300, 300, l.photoCrop) }} style={styles.photo} contentFit="cover" />
              <View style={{ position: "absolute", top: 8, left: 8 }}>
                <HeartButton id={l.id} size={22} />
              </View>
            </View>
            <View style={{ flex: 1, gap: 3, paddingVertical: space.sm, paddingRight: space.sm }}>
              <Text v="h3" numberOfLines={1}>
                {listingName(m.listingNames, l)}
              </Text>
              <Text v="small" numberOfLines={1}>
                {l.city}, {country(l.country)}
              </Text>
              <Text v="small" color={colors.ink}>
                <Text v="smallMedium">{price.converted ? `≈ ${price.text}` : price.text}</Text> {m.guest.card.night}
              </Text>
              <View style={{ marginTop: 4 }}>
                <ChannelStack channels={l.channels} max={5} size={20} onPhoto={false} />
              </View>
            </View>
            <View style={{ position: "absolute", top: 4, right: 4 }}>
              <IconButton name="close" filled={false} size={18} label={m.guest.contact.close} onPress={() => setSelected(null)} />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    ...shadow,
  },
  chipOn: { backgroundColor: colors.ink },
  count: { alignSelf: "center", backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, ...shadow },
  cardWrap: { position: "absolute", left: space.lg, right: space.lg },
  card: { flexDirection: "row", gap: space.md, backgroundColor: "#fff", borderRadius: radius.lg },
  photo: { width: 130, height: 140, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
});
