import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, mediaUrl, ownerApi, type StatusAction } from "@/api";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { REVIEWS } from "@/i18n/messages/reviews";
import { useListing } from "@/state/listing";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Button, Icon, Loading, Pill, Problem, Row, Section, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";
import { openSite } from "@/ui/settings";

const TONE = { intake: "neutral", listing: "berry", live: "green", paused: "neutral", archived: "neutral" } as const;

/** One property: its sections to edit, prices, and publishing. */
export default function ListingHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, lang, f, p } = useT();
  const l = m.listings;
  const router = useRouter();
  const { listing, setListing, failed, load } = useListing(pk);
  const [working, setWorking] = useState(false);

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <PageBar title={l.title} />
        {failed ? (
          <View style={{ padding: space.xl }}>
            <Problem text={failed === "missing" ? l.notFound : m.dashboard.error} retry={failed === "missing" ? undefined : load} retryLabel={m.dashboard.retry} />
          </View>
        ) : (
          <Loading />
        )}
      </View>
    );
  }

  const cur = (isCurrency(listing.currency) ? listing.currency : "EUR") as Currency;
  const money = (v: string) => formatPrice(lang, Number(v), cur);
  const s = l.status;
  const go = (section: string) => router.push(`/listing/${pk}/${section}`);
  const missing = listing.checklist.filter((c) => c.essential && !c.done).map((c) => l.checklist.items[c.key].toLowerCase());

  const act = (action: StatusAction, title?: string, body?: string) => {
    const run = async () => {
      setWorking(true);
      try {
        setListing(await ownerApi.setListingStatus(pk, action));
      } catch (e) {
        const reason = e instanceof ApiError ? String(e.body.reason ?? "") : "";
        const count = e instanceof ApiError ? Number(e.body.count ?? 0) : 0;
        if (reason === "future_bookings") Alert.alert(s.archiveTitle, p(s.futureBookings, count));
        else if (reason === "incomplete") Alert.alert(s.publish, f(s.missing, { items: missing.join(", ") }));
        else Alert.alert(e instanceof ApiError ? s.notAllowed : l.networkError);
      } finally {
        setWorking(false);
      }
    };
    if (title) Alert.alert(title, body, [{ text: l.cancel, style: "cancel" }, { text: s[action === "pause" ? "pause" : "archive"], style: "destructive", onPress: run }]);
    else void run();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={listing.name} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
        {listing.cover ? (
          <Image source={{ uri: mediaUrl(listing.cover) }} style={styles.cover} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cover, styles.noCover]}>
            <Icon name="image-outline" size={40} color={colors.faint} />
            <Button small kind="secondary" icon="add" label={l.photos.add} onPress={() => go("photos")} />
          </View>
        )}

        <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text v="title" style={{ flex: 1 }}>
              {listing.name}
            </Text>
            <Pill label={l.statusNames[listing.status]} tone={TONE[listing.status]} />
          </View>
          <Text v="small">{s.explain[listing.status]}</Text>
          {listing.completeness < 100 ? (
            <View style={{ gap: 6, marginTop: space.xs }}>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${listing.completeness}%` }]} />
              </View>
              <Text v="tiny">{f(l.checklist.title, { pct: listing.completeness })}</Text>
              {missing.length ? <Text v="small" color={colors.ink}>{f(s.missing, { items: missing.join(", ") })}</Text> : null}
            </View>
          ) : null}

          {listing.status === "intake" ? (
            <Button label={s.publish} icon="rocket-outline" busy={working} disabled={missing.length > 0} onPress={() => act("publish")} style={{ marginTop: space.sm }} />
          ) : null}
          {listing.status === "paused" ? <Button label={s.relist} busy={working} onPress={() => act("relist")} style={{ marginTop: space.sm }} /> : null}
          {listing.status === "archived" ? <Button kind="secondary" label={s.restore} busy={working} onPress={() => act("restore")} style={{ marginTop: space.sm }} /> : null}

          <Section title={l.nav.overview}>
            <Row icon="images-outline" label={l.nav.photos} detail={p(l.units.photos, listing.photo_count)} onPress={() => go("photos")} />
            <Row
              icon="document-text-outline"
              label={l.nav.basics}
              detail={[p(l.units.guests, listing.max_guests), p(l.units.bedrooms, listing.bedrooms), listing.municipality].filter(Boolean).join(" · ")}
              onPress={() => go("basics")}
            />
            <Row icon="checkbox-outline" label={l.nav.amenities} detail={p(l.amenities.selected, listing.amenities.length)} onPress={() => go("amenities")} />
            <Row
              icon="pricetag-outline"
              label={l.nav.pricing}
              detail={`${f(l.perNight, { price: money(listing.price_per_night) })}${listing.smart_pricing ? ` · ${l.pricing.smart}` : ""}`}
              onPress={() => go("pricing")}
            />
            <Row icon="calendar-outline" label={m.app.listing.calendarPrices} detail={l.nightPrices.lead} onPress={() => router.push({ pathname: "/calendar", params: { cottage: String(pk) } })} />
            <Row icon="home-outline" label={l.nav.rules} onPress={() => go("rules")} />
            <Row icon="key-outline" label={l.nav.arrival} detail={l.arrival.private} onPress={() => go("arrival")} />
            <Row icon="star-outline" label={REVIEWS[lang].owner.title} onPress={() => go("reviews")} />
            <Row icon="link-outline" label={m.app.menu.settings} onPress={() => router.push(`/cottage-settings/${pk}`)} />
            <Row icon="globe-outline" label={m.app.listing.onWeb} detail={m.app.listing.onWebLead} onPress={() => openSite(`/${lang}/hosting/listings/${pk}`)} last />
          </Section>

          <Text v="small" style={{ marginTop: space.lg }}>
            {l.stugoraOnly}
          </Text>

          {listing.status === "live" ? (
            <Section title={s.title}>
              <Button kind="secondary" label={s.pause} busy={working} onPress={() => act("pause", s.pauseTitle, s.pauseBody)} />
            </Section>
          ) : null}
          {listing.status !== "archived" && listing.status !== "intake" ? (
            <Button kind="ghost" label={s.archive} onPress={() => act("archive", s.archiveTitle, s.archiveBody)} style={{ alignSelf: "flex-start", marginTop: space.md }} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", aspectRatio: 3 / 2, backgroundColor: colors.ground },
  noCover: { alignItems: "center", justifyContent: "center", gap: space.md },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.ground, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.green },
});
