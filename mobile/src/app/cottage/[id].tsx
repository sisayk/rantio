import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SITE_URL } from "@/api";
import { activitiesFor } from "@/lib/activities";
import { CHANNELS, channelIcon, FEATURE_GROUPS } from "@/lib/catalog";
import { getListing, listingCurrency, listingName, listingPhotos, unsplash, unsplashWhole } from "@/lib/listings";
import { findNearby, type NearbyPlace } from "@/lib/nearby";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import { useMoney } from "@/state/money";
import { useT } from "@/text/i18n";
import { colors, radius, shadowFloat, space } from "@/theme";
import { Button, Empty, Icon, IconButton, Pill, Text } from "@/ui/kit";
import { CATEGORY_ICONS, HeartButton } from "@/ui/listing";
import { openSite } from "@/ui/settings";

const SEASON_TONE = { summer: "green", winter: "neutral", autumn: "berry", darkSeason: "neutral", allYear: "green" } as const;

export default function Cottage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = getListing(id);
  const { m, p, f, lang, country } = useT();
  const money = useMoney();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState(0);
  const [nearby, setNearby] = useState<NearbyPlace[] | null | "error">(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!l) return;
    const ac = new AbortController();
    findNearby(l.lat, l.lng, lang, ac.signal, 8)
      .then(setNearby)
      .catch(() => !ac.signal.aborted && setNearby("error"));
    return () => ac.abort();
  }, [l, lang]);

  if (!l) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Empty icon="home-outline" title={m.guest.empty.title} action={<Button label={m.guest.detail.back} onPress={() => router.replace("/explore")} />} />
      </SafeAreaView>
    );
  }

  const name = listingName(m.listingNames, l);
  const region = PLACES[l.country]?.find((r) => r.id === l.region);
  const photos = listingPhotos(l);
  const photoHeight = Math.round(Math.min(width * 0.82, 520));
  const price = money.show(l.price, listingCurrency(l));
  const activities = activitiesFor(l, m.activities);
  const amenities = FEATURE_GROUPS.filter((g) => g.id !== "booking")
    .map((g) => ({
      id: g.id,
      title: m.catalog.groups[g.id],
      items: g.options.filter((k) => (l.features as string[]).includes(k)).map((k) => m.catalog.features[k]),
    }))
    .filter((g) => g.items.length);
  const flags = (["instantBook", "freeCancellation"] as const).filter((k) => (l.features as string[]).includes(k));
  const pageUrl = `${SITE_URL}/${lang}/cottages/${l.id}`;
  const shownActivities = showAll ? activities : activities.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(x) => x.id}
            onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image
                source={{ uri: unsplash(item.id, Math.round(width * 2), photoHeight * 2, item.crop) }}
                placeholder={{ uri: unsplashWhole(item.id, 40) }}
                style={{ width, height: photoHeight }}
                contentFit="cover"
                transition={250}
                accessibilityLabel={m.guest.photos[item.kind]}
              />
            )}
          />
          <View style={styles.counter} pointerEvents="none">
            <Text v="tiny" color="#fff">
              {photo + 1} / {photos.length}
            </Text>
          </View>
          <View style={[styles.topButtons, { top: insets.top + space.sm }]}>
            <IconButton name="chevron-back" label={m.guest.detail.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <IconButton
                name={Platform.OS === "ios" ? "share-outline" : "share-social-outline"}
                label={m.app.common.share}
                onPress={() => Share.share(Platform.OS === "ios" ? { url: pageUrl, message: name } : { message: `${name}\n${pageUrl}` })}
              />
              <View style={styles.heartWrap}>
                <HeartButton id={l.id} size={20} onPhoto={false} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text v="title">{name}</Text>
          <Text v="small" style={{ marginTop: 4 }}>
            {[l.city, region ? regionLabel(region, l.country, lang) : null, country(l.country)].filter(Boolean).join(", ")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
            {l.rating ? (
              <>
                <Icon name="star" size={14} />
                <Text v="smallMedium">{l.rating.toFixed(1)}</Text>
              </>
            ) : (
              <Pill label={m.guest.card.isNew} tone="green" />
            )}
          </View>

          <View style={styles.facts}>
            <Fact icon="people-outline" text={p(m.guest.units.guests, l.guests)} />
            <Fact icon="bed-outline" text={p(m.guest.units.bedrooms, l.bedrooms)} />
            {l.categories.map((c) => (
              <Fact key={c} icon={CATEGORY_ICONS[c]} text={m.guest.badges[c]} />
            ))}
          </View>

          {flags.length ? (
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {flags.map((k) => (
                <View key={k} style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                  <Icon name="checkmark-circle-outline" size={20} color={colors.green} />
                  <Text v="body">{m.catalog.features[k]}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Divider />
          <Text v="h2">{m.guest.detail.activitiesTitle}</Text>
          <Text v="small" style={{ marginBottom: space.md }}>
            {m.guest.detail.activitiesLead}
          </Text>
          {shownActivities.map((a) => (
            <View key={a.id} style={styles.activity}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text v="h3">{a.title}</Text>
                <Text v="small" color={colors.ink}>
                  {a.body}
                </Text>
                <Pill label={m.activities.seasons[a.season]} tone={SEASON_TONE[a.season]} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
          {activities.length > 4 ? (
            <Button kind="secondary" small label={showAll ? m.guest.detail.showLess : m.guest.detail.showMore} onPress={() => setShowAll(!showAll)} style={{ alignSelf: "flex-start", marginTop: space.sm }} />
          ) : null}

          <Divider />
          <Text v="h2">{m.guest.detail.amenitiesTitle}</Text>
          {amenities.map((g) => (
            <View key={g.id} style={{ marginTop: space.lg }}>
              <Text v="h3" style={{ marginBottom: space.xs }}>
                {g.title}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.xs }}>
                {g.items.map((item) => (
                  <View key={item} style={styles.amenity}>
                    <Icon name="checkmark" size={16} color={colors.green} />
                    <Text v="small" color={colors.ink} style={{ flexShrink: 1 }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Divider />
          <Text v="h2">{m.guest.detail.nearbyTitle}</Text>
          <Text v="small" style={{ marginBottom: space.md }}>
            {m.guest.detail.nearbyLead}
          </Text>
          {nearby === null ? (
            <Text v="small">{m.guest.detail.loading}</Text>
          ) : nearby === "error" ? (
            <Text v="small">{m.guest.detail.error}</Text>
          ) : nearby.length === 0 ? (
            <Text v="small">{m.guest.detail.empty}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ marginHorizontal: -space.xl }}>
              <View style={{ width: space.xl - space.md }} />
              {nearby.map((n) => (
                <Pressable key={n.key} onPress={() => Linking.openURL(n.url)} style={styles.nearby} accessibilityRole="link">
                  {n.thumb ? <Image source={{ uri: n.thumb }} style={styles.nearbyPhoto} contentFit="cover" /> : <View style={[styles.nearbyPhoto, { backgroundColor: colors.greenTint }]} />}
                  <View style={{ padding: space.md, gap: 2 }}>
                    <Text v="h3" numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text v="small" numberOfLines={2}>
                      {n.description}
                    </Text>
                    <Text v="tiny">{f(m.guest.detail.away, { distance: `${n.km < 1 ? n.km.toFixed(1) : Math.round(n.km)} km` })}</Text>
                  </View>
                </Pressable>
              ))}
              <View style={{ width: space.xl - space.md }} />
            </ScrollView>
          )}
          {nearby && nearby !== "error" && nearby.length ? (
            <Text v="tiny" style={{ marginTop: space.sm }}>
              {m.guest.detail.source}
            </Text>
          ) : null}

          <Divider />
          <Text v="h2">{m.guest.detail.bookTitle}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {l.channels.map((c) => (
              <View key={c} style={styles.channel}>
                <Image source={{ uri: channelIcon(c) }} style={{ width: 18, height: 18, borderRadius: 4 }} />
                <Text v="smallMedium">{CHANNELS[c].name}</Text>
              </View>
            ))}
          </View>
          <Text v="small" style={{ marginTop: space.md }}>
            {m.guest.detail.bookNote}
          </Text>
          <Button kind="ghost" label={m.app.profile.listCottage} onPress={() => openSite(`/${lang}/hosts`)} style={{ alignSelf: "flex-start", marginTop: space.sm, paddingHorizontal: 0 }} />
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={[styles.footer, shadowFloat]}>
        <View style={{ flex: 1 }}>
          <Text v="h3">
            {price.converted ? `≈ ${price.text}` : price.text} <Text v="small">{m.guest.card.night}</Text>
          </Text>
          {price.converted ? <Text v="tiny">{f(m.guest.currency.original, { price: money.format(l.price, listingCurrency(l)) })}</Text> : null}
        </View>
        <Button label={m.guest.contact.button} icon="chatbubble-ellipses-outline" onPress={() => router.push(`/contact/${l.id}`)} />
      </SafeAreaView>
    </View>
  );
}

function Fact({ icon, text }: { icon: Parameters<typeof Icon>[0]["name"]; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} />
      <Text v="smallMedium">{text}</Text>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  topButtons: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", justifyContent: "space-between" },
  heartWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" },
  counter: { position: "absolute", right: space.lg, bottom: space.lg, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  body: { padding: space.xl, marginTop: -space.lg, backgroundColor: colors.page, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  fact: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ground },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.xl },
  activity: { flexDirection: "row", gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  amenity: { flexDirection: "row", alignItems: "center", gap: 6, width: "50%", paddingRight: space.sm },
  nearby: { width: 230, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.page },
  nearbyPhoto: { width: 230, height: 130 },
  channel: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
