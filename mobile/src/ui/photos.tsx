// The photo tour, as on Airbnb: every photo in a grid by room, and a full-screen
// viewer to swipe through them and pinch to zoom (zoom works on iPhone).
import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ListingPhoto, type PhotoKind, unsplash, unsplashWhole } from "@/lib/listings";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Button, IconButton, Text } from "@/ui/kit";

const ORDER: PhotoKind[] = ["exterior", "living", "bedroom", "kitchen", "sauna", "outside"];

export function PhotoTour({
  visible,
  photos,
  name,
  onClose,
  onBook,
}: {
  visible: boolean;
  photos: ListingPhoto[];
  name: string;
  onClose: () => void;
  onBook: () => void;
}) {
  const { m, f } = useT();
  const { width } = useWindowDimensions();
  const [viewing, setViewing] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const full = width - space.lg * 2;
  const half = (full - space.sm) / 2;
  const groups = ORDER.map((kind) => ({ kind, items: photos.map((p, i) => ({ p, i })).filter(({ p }) => p.kind === kind) })).filter((g) => g.items.length);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/* A full-screen modal sits under the status bar, so it is padded by the screen's own insets. */}
      <View style={{ flex: 1, backgroundColor: colors.page, paddingTop: insets.top }}>
        <View style={styles.bar}>
          <IconButton name="chevron-back" label={m.app.detail.close} onPress={onClose} />
          <Text v="h3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {f(m.guest.photos.gallery, { name })}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
          {groups.map((g) => (
            <View key={g.kind} style={{ marginBottom: space.xl }}>
              <Text v="h2" style={{ marginBottom: space.md }}>
                {m.guest.photos[g.kind]}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {g.items.map(({ p, i }, n) => {
                  // A wide photo, then two side by side, and so on.
                  const wide = n % 3 === 0;
                  const w = wide ? full : half;
                  const h = wide ? Math.round(full * 0.66) : Math.round(half * 0.8);
                  return (
                    <Pressable key={p.id} onPress={() => setViewing(i)} accessibilityRole="imagebutton" accessibilityLabel={f(m.guest.photos.photoOf, { n: i + 1, total: photos.length })}>
                      <Image source={{ uri: unsplash(p.id, Math.round(w * 2), Math.round(h * 2), p.crop) }} style={{ width: w, height: h, borderRadius: radius.md, backgroundColor: colors.ground }} contentFit="cover" transition={200} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.bookWrap} pointerEvents="box-none">
          <Button label={m.app.explore.book} onPress={onBook} style={styles.book} />
        </View>
      </View>
      <PhotoViewer photos={photos} start={viewing} onClose={() => setViewing(null)} />
    </Modal>
  );
}

/** Black full-screen viewer: swipe between photos, pinch to zoom. */
export function PhotoViewer({ photos, start, onClose }: { photos: ListingPhoto[]; start: number | null; onClose: () => void }) {
  const { m, f } = useT();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  return (
    <Modal visible={start !== null} animationType="fade" presentationStyle="overFullScreen" transparent={false} onRequestClose={onClose} onShow={() => setIndex(start ?? 0)}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={start ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={{ width, height, alignItems: "center", justifyContent: "center" }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri: unsplashWhole(item.id, 1600) }} style={{ width, height: height * 0.8 }} contentFit="contain" transition={200} />
            </ScrollView>
          )}
        />
        <View style={[styles.viewerBar, { top: insets.top + space.sm }]}>
          <IconButton name="close" label={m.app.detail.close} onPress={onClose} />
          <Text v="smallMedium" color="#fff">
            {f(m.guest.photos.photoOf, { n: index + 1, total: photos.length })}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <Text v="small" color="rgba(255,255,255,0.8)" style={[styles.kind, { bottom: insets.bottom + space.xl }]}>
          {photos[index] ? m.guest.photos[photos[index].kind] : ""}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  bookWrap: { position: "absolute", left: 0, right: 0, bottom: space.xxl + 8, alignItems: "center" },
  book: { borderRadius: 999, paddingHorizontal: space.xxl * 1.5 },
  viewerBar: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kind: { position: "absolute", left: 0, right: 0, textAlign: "center" },
});
