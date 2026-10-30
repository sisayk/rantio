// A cottage as a card in a list: swipeable photos, a heart, name, place and price.
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { type Category, type Listing, listingCurrency, listingName, listingPhotos, unsplash } from "@/lib/listings";
import { useMoney } from "@/state/money";
import { usePrefs } from "@/state/prefs";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Icon, type IconName, tap, Text } from "@/ui/kit";

export const CATEGORY_ICONS: Record<Category, IconName> = {
  all: "apps-outline",
  waterfront: "water-outline",
  forest: "leaf-outline",
  modern: "cube-outline",
  traditional: "home-outline",
  sauna: "flame-outline",
  aurora: "sparkles-outline",
  skiing: "snow-outline",
  pets: "paw-outline",
  family: "people-outline",
  unique: "diamond-outline",
};

export function HeartButton({ id, size = 26, onPhoto = true }: { id: string; size?: number; onPhoto?: boolean }) {
  const { saved, toggleSaved } = usePrefs();
  const { m } = useT();
  const on = saved.includes(id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? m.guest.card.saved : m.guest.card.save}
      accessibilityState={{ selected: on }}
      hitSlop={10}
      onPress={() => {
        tap();
        toggleSaved(id);
      }}
      style={({ pressed }) => [onPhoto && styles.heartShadow, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Icon name={on ? "heart" : "heart-outline"} size={size} color={on ? colors.heart : onPhoto ? "#fff" : colors.ink} />
    </Pressable>
  );
}

function Photos({ listing, width, height }: { listing: Listing; width: number; height: number }) {
  const [index, setIndex] = useState(0);
  const photos = listingPhotos(listing).slice(0, 6);
  const router = useRouter();
  return (
    <View style={{ width, height, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.ground }}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/cottage/${listing.id}`)} accessibilityRole="imagebutton">
            <Image
              source={unsplash(item.id, Math.round(width * 2), Math.round(height * 2), item.crop)}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
              recyclingKey={item.id}
            />
          </Pressable>
        )}
      />
      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const ListingCard = memo(function ListingCard({ listing, width }: { listing: Listing; width?: number }) {
  const { m, p, country } = useT();
  const money = useMoney();
  const router = useRouter();
  const screen = useWindowDimensions();
  const w = width ?? screen.width - space.xl * 2;
  const h = Math.round(w * 0.95);
  const price = money.show(listing.price, listingCurrency(listing));
  return (
    <View style={{ width: w, marginBottom: space.xxl }}>
      <View>
        <Photos listing={listing} width={w} height={h} />
        <View style={styles.badge} pointerEvents="none">
          <Text v="tiny" color={colors.ink}>
            {m.guest.badges[listing.badge]}
          </Text>
        </View>
        <View style={styles.heart}>
          <HeartButton id={listing.id} />
        </View>
      </View>
      <Pressable onPress={() => router.push(`/cottage/${listing.id}`)} style={{ paddingTop: space.md, gap: 2 }} accessibilityRole="link">
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
          <Text v="h3" numberOfLines={1} style={{ flex: 1 }}>
            {listingName(m.listingNames, listing)}
          </Text>
          {listing.rating ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="star" size={13} />
              <Text v="smallMedium">{listing.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text v="small" numberOfLines={1}>
          {listing.place}, {country(listing.country)}
        </Text>
        <Text v="small">
          {p(m.guest.units.guests, listing.guests)} · {p(m.guest.units.bedrooms, listing.bedrooms)}
        </Text>
        <Text v="body" style={{ marginTop: 4 }}>
          <Text v="h3">{price.converted ? `≈ ${price.text}` : price.text}</Text> {m.guest.card.night}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  dotOn: { backgroundColor: "#fff" },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  heart: { position: "absolute", top: 12, right: 14 },
  heartShadow: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
});
