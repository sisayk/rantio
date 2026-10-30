import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SITE_URL } from "@/api";
import { activitiesFor } from "@/lib/activities";
import { CHANNELS, type ChannelId, channelIcon, FEATURE_GROUPS, type FeatureKey } from "@/lib/catalog";
import { getListing, listingCurrency, listingName, listingPhotos, unsplash, unsplashWhole } from "@/lib/listings";
import { findNearby, type NearbyPlace } from "@/lib/nearby";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import { useMoney } from "@/state/money";
import { daysBetween, formatRange } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, shadowFloat, space } from "@/theme";
import { ChannelStack, ChannelTile } from "@/ui/channels";
import { AmenityRow, NOT_INCLUDED } from "@/ui/amenities";
import { Button, Empty, Icon, IconButton, Pill, Problem, Text } from "@/ui/kit";
import { CATEGORY_ICONS, HeartButton } from "@/ui/listing";
import { PinMap } from "@/ui/maps";
import { PhotoTour } from "@/ui/photos";
import { RangeCalendar } from "@/ui/range-calendar";
import { ModalFoot, SheetBar } from "@/ui/screen";
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
  const [booking, setBooking] = useState(false);
  const [note, setNote] = useState(false);
  const [tour, setTour] = useState(false);
  const [allAmenities, setAllAmenities] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dates, setDates] = useState<[string | null, string | null]>([null, null]);

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
  const has = (k: FeatureKey) => (l.features as string[]).includes(k);
  const amenities = FEATURE_GROUPS.filter((g) => g.id !== "booking")
    .map((g) => ({ id: g.id, title: m.catalog.groups[g.id], items: (g.options as readonly FeatureKey[]).filter(has) }))
    .filter((g) => g.items.length);
  const amenityCount = amenities.reduce((n, g) => n + g.items.length, 0);
  const missing = NOT_INCLUDED.filter((k) => !has(k));
  const nights = dates[0] && dates[1] ? daysBetween(dates[0], dates[1]) : 0;
  const total = nights ? money.show(l.price * nights, listingCurrency(l)) : null;
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
              <Pressable onPress={() => setTour(true)} accessibilityRole="imagebutton" accessibilityLabel={m.app.detail.photos}>
                <Image
                  source={{ uri: unsplash(item.id, Math.round(width * 2), photoHeight * 2, item.crop) }}
                  placeholder={{ uri: unsplashWhole(item.id, 40) }}
                  style={{ width, height: photoHeight }}
                  contentFit="cover"
                  transition={250}
                  accessibilityLabel={m.guest.photos[item.kind]}
                />
              </Pressable>
            )}
          />
          <Pressable style={styles.counter} onPress={() => setTour(true)} accessibilityRole="button" accessibilityLabel={f(m.guest.photos.showAll, { n: photos.length })}>
            <Icon name="grid-outline" size={13} color="#fff" />
            <Text v="tiny" color="#fff">
              {photo + 1} / {photos.length}
            </Text>
          </Pressable>
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

          <Pressable onPress={() => setBooking(true)} style={styles.listedOn} accessibilityRole="button">
            <View style={{ flex: 1, gap: 6 }}>
              <Text v="smallMedium">{m.app.explore.listedOn}</Text>
              <ChannelStack channels={l.channels} max={6} size={26} onPhoto={false} />
            </View>
            <Icon name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>

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
          <Text v="h2">{m.app.detail.offers}</Text>
          <View style={{ marginTop: space.sm }}>
            {amenities
              .flatMap((g) => g.items)
              .slice(0, 6)
              .map((k, i, a) => (
                <AmenityRow key={k} feature={k} label={m.catalog.features[k]} last={i === a.length - 1} />
              ))}
          </View>
          <Button kind="secondary" label={f(m.app.detail.showAmenities, { n: amenityCount })} onPress={() => setAllAmenities(true)} style={{ marginTop: space.md }} />

          <Divider />
          <Pressable onPress={() => setPicking(true)} style={styles.availability} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text v="h2">{m.app.detail.availability}</Text>
              <Text v="small">{dates[0] && dates[1] ? `${formatRange(lang, dates[0], dates[1])} · ${p(m.guest.units.nights, nights)}` : m.guest.datePicker.addDates}</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.soft} />
          </Pressable>

          <Divider />
          <Text v="h2">{m.app.explore.whereYoullBe}</Text>
          <Text v="small" style={{ marginBottom: space.md }}>
            {[l.city, region ? regionLabel(region, l.country, lang) : null, country(l.country)].filter(Boolean).join(", ")}
          </Text>
          <Pressable
            onPress={() =>
              Linking.openURL(
                Platform.OS === "ios" ? `maps:?q=${encodeURIComponent(name)}&ll=${l.lat},${l.lng}` : `geo:${l.lat},${l.lng}?q=${l.lat},${l.lng}(${encodeURIComponent(name)})`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={m.guest.detail.map}
            style={styles.mapFrame}
          >
            <PinMap lat={l.lat} lng={l.lng} style={{ flex: 1 }} />
          </Pressable>

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
          <Text v="h2">{m.app.detail.know}</Text>
          <Know emoji="💳" title={m.app.detail.paidOn} lead={m.app.detail.paidOnLead} />
          <Know
            emoji="🗓️"
            title={m.app.detail.cancellation}
            lead={has("freeCancellation") ? m.catalog.features.freeCancellation : m.app.detail.cancelSite}
          />
          <Know emoji="💬" title={m.app.detail.ask} lead={m.guest.contact.lead} onPress={() => router.push(`/contact/${l.id}`)} />

          <Divider />
          <Text v="h2">{m.guest.detail.bookTitle}</Text>
          <View style={{ marginTop: space.sm }}>
            {l.channels.map((c, i) => (
              <SiteRow key={c} channel={c} last={i === l.channels.length - 1} onPress={() => setBooking(true)} />
            ))}
          </View>
          <Text v="small" style={{ marginTop: space.md }}>
            {m.guest.detail.bookNote}
          </Text>
          <Button kind="ghost" label={m.app.profile.listCottage} onPress={() => openSite(`/${lang}/hosts`)} style={{ alignSelf: "flex-start", marginTop: space.sm, paddingHorizontal: 0 }} />
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={[styles.footer, shadowFloat]}>
        <Pressable style={{ flex: 1 }} onPress={() => setPicking(true)} accessibilityRole="button">
          {total && dates[0] && dates[1] ? (
            <>
              <Text v="h3" style={{ textDecorationLine: "underline" }}>
                {f(m.app.explore.forNights, { price: `${total.converted ? "≈ " : ""}${total.text}`, nights: p(m.guest.units.nights, nights) })}
              </Text>
              <Text v="tiny">{formatRange(lang, dates[0], dates[1])}</Text>
            </>
          ) : (
            <>
              <Text v="h3">
                {price.converted ? `≈ ${price.text}` : price.text} <Text v="small">{m.guest.card.night}</Text>
              </Text>
              <Text v="tiny" style={{ textDecorationLine: "underline" }}>
                {m.guest.datePicker.addDates}
              </Text>
            </>
          )}
        </Pressable>
        <IconButton name="chatbubble-ellipses-outline" filled={false} label={m.guest.contact.button} onPress={() => router.push(`/contact/${l.id}`)} size={24} />
        <Button label={m.app.explore.book} onPress={() => setBooking(true)} style={{ paddingHorizontal: space.xxl }} />
      </SafeAreaView>

      <Modal visible={booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBooking(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={m.app.explore.chooseSite} onClose={() => setBooking(false)} />
          <ScrollView contentContainerStyle={{ padding: space.xl }}>
            <Text v="h2">{name}</Text>
            <Text v="small" style={{ marginTop: space.xs, marginBottom: space.md }}>
              {m.app.explore.chooseLead}
            </Text>
            {l.channels.map((c, i) => (
              <SiteRow key={c} channel={c} last={i === l.channels.length - 1} onPress={() => setNote(true)} big />
            ))}
            {note ? <Problem text={m.guest.detail.bookNote} /> : null}
            <Text v="tiny" style={{ marginTop: space.lg }}>
              {m.guest.detail.bookNote}
            </Text>
            <Button
              kind="secondary"
              icon="chatbubble-ellipses-outline"
              label={m.guest.contact.button}
              onPress={() => {
                setBooking(false);
                router.push(`/contact/${l.id}`);
              }}
              style={{ marginTop: space.xl }}
            />
          </ScrollView>
        </View>
      </Modal>

      <PhotoTour
        visible={tour}
        photos={photos}
        name={name}
        onClose={() => setTour(false)}
        onBook={() => {
          setTour(false);
          setBooking(true);
        }}
      />

      <Modal visible={allAmenities} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAllAmenities(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title="" onClose={() => setAllAmenities(false)} />
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }}>
            <Text v="title">{m.app.detail.offers}</Text>
            {amenities.map((g) => (
              <View key={g.id} style={{ marginTop: space.xl }}>
                <Text v="h3">{g.title}</Text>
                {g.items.map((k, i) => (
                  <AmenityRow key={k} feature={k} label={m.catalog.features[k]} last={i === g.items.length - 1} />
                ))}
              </View>
            ))}
            {missing.length ? (
              <View style={{ marginTop: space.xl }}>
                <Text v="h3">{m.app.detail.notIncluded}</Text>
                {missing.map((k, i) => (
                  <AmenityRow key={k} feature={k} label={m.catalog.features[k]} missing last={i === missing.length - 1} />
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={m.guest.datePicker.title} onClose={() => setPicking(false)} />
          <ScrollView contentContainerStyle={{ padding: space.lg }}>
            <RangeCalendar lang={lang} start={dates[0]} end={dates[1]} onChange={(a, b) => setDates([a, b])} months={12} />
          </ScrollView>
          <ModalFoot style={styles.pickFoot}>
            <Button kind="ghost" label={m.guest.datePicker.clear} onPress={() => setDates([null, null])} />
            <Button label={m.guest.datePicker.done} onPress={() => setPicking(false)} />
          </ModalFoot>
        </View>
      </Modal>
    </View>
  );
}

function Know({ emoji, title, lead, onPress }: { emoji: string; title: string; lead: string; onPress?: () => void }) {
  const body = (
    <View style={styles.know}>
      <Text style={{ fontSize: 28, lineHeight: 34 }}>{emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text v="h3">{title}</Text>
        <Text v="small">{lead}</Text>
      </View>
      {onPress ? <Icon name="chevron-forward" size={18} color={colors.soft} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

function SiteRow({ channel, last, onPress, big }: { channel: ChannelId; last?: boolean; onPress: () => void; big?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.siteRow, !last && styles.siteLine, pressed && { opacity: 0.6 }]}
    >
      {big ? (
        <ChannelTile channel={channel} />
      ) : (
        <Image source={{ uri: channelIcon(channel) }} style={{ width: 24, height: 24, borderRadius: 6 }} />
      )}
      <Text v={big ? "h3" : "bodyMedium"} style={{ flex: 1 }}>
        {CHANNELS[channel].name}
      </Text>
      <Icon name={big ? "open-outline" : "chevron-forward"} size={18} color={colors.soft} />
    </Pressable>
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
  availability: { flexDirection: "row", alignItems: "center", gap: space.md },
  know: { flexDirection: "row", alignItems: "flex-start", gap: space.lg, paddingVertical: space.md },
  pickFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  counter: { position: "absolute", right: space.lg, bottom: space.xxl, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  body: { padding: space.xl, marginTop: -space.lg, backgroundColor: colors.page, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  fact: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ground },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.xl },
  activity: { flexDirection: "row", gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  amenity: { flexDirection: "row", alignItems: "center", gap: 6, width: "50%", paddingRight: space.sm },
  nearby: { width: 230, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.page },
  nearbyPhoto: { width: 230, height: 130 },
  listedOn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  mapFrame: { height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.greenTint },
  siteRow: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md },
  siteLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
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
