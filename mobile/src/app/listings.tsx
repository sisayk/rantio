import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { type ListingSummary, mediaUrl, ownerApi } from "@/api";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { useT } from "@/text/i18n";
import { colors, radius, shadow, space } from "@/theme";
import { styles as formStyles } from "@/ui/form";
import { Button, Empty, Icon, Loading, Pill, Problem, Text } from "@/ui/kit";
import { ModalFoot, PageBar, SheetBar } from "@/ui/screen";

const TONE = { intake: "neutral", listing: "berry", live: "green", paused: "neutral", archived: "neutral" } as const;

/** Hosting → My listings: every property with its cover, status and price; add a new one. */
export default function Listings() {
  const { m, lang, f, p } = useT();
  const l = m.listings;
  const router = useRouter();
  const [rows, setRows] = useState<ListingSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await ownerApi.listings()).cottages);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const made = await ownerApi.createListing(name.trim());
      setAdding(false);
      setName("");
      router.push(`/listing/${made.id}`);
    } catch {
      Alert.alert(l.networkError);
    } finally {
      setBusy(false);
    }
  };

  const price = (c: ListingSummary) => formatPrice(lang, Number(c.price_per_night), (isCurrency(c.currency) ? c.currency : "EUR") as Currency);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={l.title} right={<Button small label={l.add} icon="add" onPress={() => setAdding(true)} />} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.green}
          />
        }
      >
        <Text v="small">{l.lead}</Text>
        {failed && !rows ? <Problem text={m.dashboard.error} retry={load} retryLabel={m.dashboard.retry} /> : null}
        {!rows && !failed ? <Loading /> : null}
        {rows && rows.length === 0 ? <Empty icon="home-outline" title={l.add} lead={l.empty} action={<Button label={l.add} onPress={() => setAdding(true)} />} /> : null}
        {rows?.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/listing/${c.id}`)}
            style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={c.name}
          >
            {c.cover ? (
              <Image source={{ uri: mediaUrl(c.cover) }} style={styles.cover} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.cover, styles.noCover]}>
                <Icon name="image-outline" size={34} color={colors.faint} />
                <Text v="small">{l.noPhotos}</Text>
              </View>
            )}
            <View style={{ padding: space.lg, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Text v="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Pill label={l.statusNames[c.status]} tone={TONE[c.status]} />
              </View>
              <Text v="small" numberOfLines={1}>
                {[c.municipality, p(l.units.guests, c.max_guests), p(l.units.photos, c.photo_count)].filter(Boolean).join(" · ")}
              </Text>
              <Text v="bodyMedium">{f(l.perNight, { price: price(c) })}</Text>
              {c.completeness < 100 ? (
                <View style={{ gap: 4, marginTop: space.xs }}>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${c.completeness}%` }]} />
                  </View>
                  <Text v="tiny">{f(l.complete, { pct: c.completeness })}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={l.addTitle} onClose={() => setAdding(false)} />
          <View style={{ padding: space.xl, gap: space.md }}>
            <Text v="smallMedium">{l.addName}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={l.addPlaceholder}
              placeholderTextColor={colors.faint}
              autoFocus
              maxLength={120}
              style={formStyles.input}
              accessibilityLabel={l.addName}
              onSubmitEditing={create}
              returnKeyType="done"
            />
          </View>
          <ModalFoot style={{ paddingHorizontal: space.xl }}>
            <Button label={l.addCreate} busy={busy} disabled={!name.trim()} onPress={create} />
          </ModalFoot>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.lg, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.ground },
  noCover: { alignItems: "center", justifyContent: "center", gap: space.xs },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.ground, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.green },
});
