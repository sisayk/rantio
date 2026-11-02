import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { ApiError, type ListingPhoto, Offline, ownerApi, type PhotoKind } from "@/api";
import { useListing } from "@/state/listing";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { Button, Icon, Loading, Problem, Text } from "@/ui/kit";
import { ModalFoot, PageBar, SheetBar } from "@/ui/screen";

const KINDS: PhotoKind[] = ["exterior", "living", "bedroom", "kitchen", "sauna", "outside"];
const MAX = 40;
const LONG_SIDE = 2400; // like the website: big enough for any screen, small enough to upload quickly

/** The listing's photos: add from the phone or the camera, choose the cover, order, room, delete. */
export default function ListingPhotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, f } = useT();
  const l = m.listings;
  const t = l.photos;
  const { width } = useWindowDimensions();
  const { listing, setListing, failed, load } = useListing(pk);
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ListingPhoto | null>(null);
  const [working, setWorking] = useState(false);

  const photos = listing?.photos ?? [];
  const setPhotos = (next: ListingPhoto[]) => setListing((cur) => (cur ? { ...cur, photos: next, photo_count: next.length, cover: next[0]?.url ?? null } : cur));

  const add = async (from: "library" | "camera") => {
    setProblem(null);
    const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(m.app.listing.permission, undefined, [
        { text: l.cancel, style: "cancel" },
        { text: m.app.menu.openSettings, onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const room = Math.max(0, MAX - photos.length);
    if (!room) return setProblem(t.errors.too_many);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    };
    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: Math.min(room, 20), orderedSelection: true });
    if (result.canceled || !result.assets.length) return;
    const assets = result.assets.slice(0, room);
    let added = [...photos];
    for (let i = 0; i < assets.length; i++) {
      setProgress({ n: i + 1, total: assets.length });
      const a = assets[i];
      try {
        // Make it a JPEG no longer than LONG_SIDE, as the website does before uploading.
        const ctx = ImageManipulator.manipulate(a.uri);
        if (Math.max(a.width, a.height) > LONG_SIDE) ctx.resize(a.width >= a.height ? { width: LONG_SIDE } : { height: LONG_SIDE });
        const image = await ctx.renderAsync();
        const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
        const photo = await ownerApi.addPhoto(pk, saved.uri, added.length === 0 ? "exterior" : undefined);
        added = [...added, photo];
        setPhotos(added);
      } catch (e) {
        const code = e instanceof ApiError ? String((e.body.file as string[] | undefined)?.[0] ?? "") : "";
        const name = a.fileName ?? `${i + 1}`;
        setProblem(
          code === "too_big"
            ? f(t.errors.too_big, { name })
            : code === "not_image"
              ? f(t.errors.not_image, { name })
              : code === "too_many"
                ? t.errors.too_many
                : e instanceof Offline
                  ? m.app.common.offline
                  : f(t.errors.failed, { name }),
        );
        break;
      }
    }
    setProgress(null);
  };

  const reorder = async (ids: number[]) => {
    setWorking(true);
    try {
      setPhotos((await ownerApi.orderPhotos(pk, ids)).photos);
    } catch {
      setProblem(l.networkError);
    } finally {
      setWorking(false);
    }
  };

  const move = (photo: ListingPhoto, to: number) => {
    const ids = photos.map((x) => x.id).filter((x) => x !== photo.id);
    ids.splice(Math.max(0, Math.min(ids.length, to)), 0, photo.id);
    setChosen(null);
    void reorder(ids);
  };

  const setKind = async (photo: ListingPhoto, kind: PhotoKind) => {
    setChosen({ ...photo, kind });
    try {
      const saved = await ownerApi.updatePhoto(pk, photo.id, { kind });
      setPhotos(photos.map((x) => (x.id === photo.id ? saved : x)));
    } catch {
      setProblem(l.networkError);
    }
  };

  const remove = (photo: ListingPhoto) =>
    Alert.alert(t.removeTitle, t.removeBody, [
      { text: l.cancel, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: async () => {
          setChosen(null);
          try {
            await ownerApi.deletePhoto(pk, photo.id);
            void load();
          } catch {
            setProblem(l.networkError);
          }
        },
      },
    ]);

  const size = (width - space.xl * 2 - space.sm) / 2;
  const index = chosen ? photos.findIndex((x) => x.id === chosen.id) : -1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={t.title} />
      {!listing ? (
        failed ? (
          <View style={{ padding: space.xl }}>
            <Problem text={m.dashboard.error} retry={load} retryLabel={m.dashboard.retry} />
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: 140 }}>
          <Text v="small">{t.lead.split(". ").slice(0, 1).join("")}.</Text>
          <Text v="tiny">{f(t.count, { n: photos.length, max: MAX })}</Text>
          {problem ? <Problem text={problem} /> : null}
          {photos.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="images-outline" size={36} color={colors.faint} />
              <Text v="small" style={{ textAlign: "center" }}>
                {t.empty}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {photos.map((photo, i) => (
                <Pressable
                  key={photo.id}
                  onPress={() => setChosen(photo)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.kinds[photo.kind]}${i === 0 ? `, ${t.cover}` : ""}`}
                  style={({ pressed }) => [{ width: size }, pressed && { opacity: 0.8 }]}
                >
                  <Image source={{ uri: photo.url }} style={[styles.photo, { width: size, height: size * 0.75 }]} contentFit="cover" transition={150} />
                  {i === 0 ? (
                    <Text v="tiny" color="#fff" style={styles.badge}>
                      {t.cover}
                    </Text>
                  ) : null}
                  <Text v="tiny" style={{ marginTop: 4 }}>
                    {t.kinds[photo.kind]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {listing ? (
        <ModalFoot style={styles.foot}>
          {progress ? (
            <Text v="smallMedium" style={{ textAlign: "center" }}>
              {f(m.app.listing.uploading, { n: progress.n, total: progress.total })}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button kind="secondary" icon="camera-outline" label={t.camera} onPress={() => add("camera")} disabled={!!progress} style={{ flex: 1 }} />
            <Button icon="images-outline" label={m.app.listing.library} onPress={() => add("library")} busy={!!progress} style={{ flex: 1 }} />
          </View>
        </ModalFoot>
      ) : null}

      <Modal visible={!!chosen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChosen(null)}>
        {chosen ? (
          <View style={{ flex: 1, backgroundColor: colors.page }}>
            <SheetBar title={m.app.listing.photoActions} onClose={() => setChosen(null)} />
            <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
              <Image source={{ uri: chosen.url }} style={styles.big} contentFit="cover" />
              <View style={{ gap: space.sm }}>
                <Text v="smallMedium">{t.room}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {KINDS.map((k) => (
                    <Chip key={k} label={t.kinds[k]} on={chosen.kind === k} onPress={() => setKind(chosen, k)} />
                  ))}
                </View>
              </View>
              <View style={{ gap: space.sm }}>
                {index > 0 ? <Button kind="secondary" icon="star-outline" label={t.makeCover} busy={working} onPress={() => move(chosen, 0)} /> : null}
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Button kind="secondary" icon="arrow-back" label={t.earlier} disabled={index <= 0} onPress={() => move(chosen, index - 1)} style={{ flex: 1 }} />
                  <Button kind="secondary" icon="arrow-forward" label={t.later} disabled={index >= photos.length - 1} onPress={() => move(chosen, index + 1)} style={{ flex: 1 }} />
                </View>
                <Button kind="danger" icon="trash-outline" label={t.remove} onPress={() => remove(chosen)} />
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  photo: { borderRadius: radius.md, backgroundColor: colors.ground },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  empty: { alignItems: "center", gap: space.md, padding: space.xxl, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line },
  foot: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.page },
  big: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.ground },
});
