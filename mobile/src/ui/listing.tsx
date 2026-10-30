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
import { ChannelStack } from "@/ui/channels";
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

/** Category chips with emoji, the way Airbnb's app uses small 3D pictures. */
export const CATEGORY_EMOJI: Record<Category, string> = {
  all: "🏡",
  waterfront: "🌊",
  forest: "🌲",
  modern: "🏙️",
  traditional: "🛖",
  sauna: "🧖",
  aurora: "🌌",
  skiing: "⛷️",
  pets: "🐕",
  family: "👨‍👩‍👧",
  unique: "✨",
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

function Photos({ listing, width, height, dots = true }: { listing: Listing; width: number; height: number; dots?: boolean }) {
  const [index, setIndex] = useState(0);
  const photos = listingPhotos(listing).slice(0, 6);
  const router = useRouter();
  return (
    <View style={{ width, height, borderRadius: dots ? radius.lg : 16, overflow: "hidden", backgroundColor: colors.ground }}>
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
      {dots && photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type CardProps = {
  listing: Listing;
  width?: number;
  /** Compact: the small cards in a sideways row, as on Airbnb's home screen. */
  compact?: boolean;
  /** Nights chosen in the search: the price is then shown for the whole stay. */
  nights?: number;
};

export const ListingCard = memo(function ListingCard({ listing, width, compact = false, nights = 0 }: CardProps) {
  const { m, p, f, country } = useT();
  const money = useMoney();
  const router = useRouter();
  const screen = useWindowDimensions();
  const w = width ?? screen.width - space.xl * 2;
  const h = Math.round(w * (compact ? 0.95 : 0.9));
  const cur = listingCurrency(listing);
  const price = money.show(listing.price, cur);
  const total = nights ? money.show(listing.price * nights, cur) : null;
  const shown = total ?? price;
  const priceText = `${shown.converted ? "≈ " : ""}${shown.text}`;
  return (
    <View style={{ width: w, marginBottom: compact ? 0 : space.xxl }}>
      <View>
        <Photos listing={listing} width={w} height={h} dots={!compact} />
        <View style={[styles.badge, compact && styles.badgeSmall]} pointerEvents="none">
          <Text v={compact ? "tiny" : "smallMedium"} color={colors.ink}>
            {m.guest.badges[listing.badge]}
          </Text>
        </View>
        <View style={styles.heart}>
          <HeartButton id={listing.id} size={compact ? 24 : 28} />
        </View>
        <View style={[styles.channels, compact && { left: 8, bottom: 8 }]} pointerEvents="none">
          <ChannelStack channels={listing.channels} max={compact ? 3 : 4} size={compact ? 18 : 22} />
        </View>
      </View>
      <Pressable onPress={() => router.push(`/cottage/${listing.id}`)} style={{ paddingTop: space.sm, gap: 1 }} accessibilityRole="link">
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
          <Text v="h3" numberOfLines={1} style={{ flex: 1, fontSize: compact ? 15 : 16 }}>
            {listingName(m.listingNames, listing)}
          </Text>
          {!compact && listing.rating ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="star" size={13} />
              <Text v="smallMedium">{listing.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text v="small" numberOfLines={1}>
          {compact ? `${listing.city}, ${country(listing.country)}` : `${listing.place}, ${country(listing.country)}`}
        </Text>
        {!compact ? (
          <Text v="small">
            {p(m.guest.units.guests, listing.guests)} · {p(m.guest.units.bedrooms, listing.bedrooms)}
          </Text>
        ) : null}
        <Text v="small" color={colors.ink} numberOfLines={1} style={{ marginTop: 2 }}>
          {total ? (
            <Text v="smallMedium" style={{ textDecorationLine: "underline" }}>
              {f(m.app.explore.forNights, { price: priceText, nights: p(m.guest.units.nights, nights) })}
            </Text>
          ) : (
            <>
              <Text v="smallMedium">{priceText}</Text> {m.guest.card.night}
            </>
          )}
          {compact && listing.rating ? ` · ★ ${listing.rating.toFixed(1)}` : ""}
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeSmall: { top: 10, left: 10, paddingHorizontal: 9, paddingVertical: 4 },
  channels: { position: "absolute", left: 12, bottom: 12 },
  heart: { position: "absolute", top: 12, right: 14 },
  heartShadow: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
});
