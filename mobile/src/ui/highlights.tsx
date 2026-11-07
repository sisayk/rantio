// The top of a cottage's page, as in Airbnb's app: rating · Guest favourite · reviews, then who
// hosts. Only real data (GET /api/cottages/<slug>/about/): the example cottages have none and show
// "New on Rantio" and no host. Guest favourite is Rantio's own rule (backend/owners/reviews.py).
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";

import { guestApi, mediaUrl, type Ratings } from "@/api";
import { HIGHLIGHTS } from "@/i18n/messages/highlights";
import { REVIEWS } from "@/i18n/messages/reviews";
import { NO_RATINGS } from "@/lib/ratingsPreview";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Avatar, Icon, Text } from "@/ui/kit";
import { STAR, useScore } from "@/ui/ratings";

export type CottageHost = { name: string; photo: string | null; since: number };
export type CottageAbout = { ratings: Ratings; guestFavourite: boolean; host: CottageHost | null };

const NOTHING: CottageAbout = { ratings: NO_RATINGS, guestFavourite: false, host: null };

/** Fetched once per cottage page; until then (and for the example cottages) nothing is known. */
export function useCottageAbout(slug: string): CottageAbout {
  const [about, setAbout] = useState<CottageAbout>(NOTHING);
  useEffect(() => {
    let live = true;
    guestApi
      .about(slug)
      .then((v) => live && setAbout({ ratings: v.ratings, guestFavourite: v.guest_favourite, host: v.host }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [slug]);
  return about;
}

const GOLD = "#c9a24a";

/** A laurel branch, mirrored for the right side. */
function Laurel({ flip = false }: { flip?: boolean }) {
  const leaves = [
    [8, 36, -55], [6, 28, -40], [5.5, 20, -25], [6.5, 12, -10], [9.5, 5, 10],
    [16.5, 31, 35], [14.5, 23, 25], [13.5, 15, 15],
  ];
  return (
    <View style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
    <Svg width={22} height={38} viewBox="0 0 26 44">
      <Path d="M19 43C10 35 8 22 12 3" fill="none" stroke={GOLD} strokeWidth={1.4} strokeLinecap="round" />
      {leaves.map(([x, y, r], i) => (
        <Ellipse key={i} cx={x} cy={y} rx={2.4} ry={4.6} rotation={r} origin={`${x}, ${y}`} fill={GOLD} />
      ))}
    </Svg>
    </View>
  );
}

export function CottageHighlights({ about, onRatings }: { about: CottageAbout; onRatings: () => void }) {
  const { lang, f, p } = useT();
  const score = useScore();
  const t = HIGHLIGHTS[lang];
  const r = REVIEWS[lang];
  const { ratings, guestFavourite, host } = about;
  const rated = ratings.count > 0 && ratings.average !== null;
  // "26" over "reviews": the language's own word for the count, without the number.
  const word = p(r.count, ratings.count).replace(/[\d\s .,]+/, " ").trim();

  return (
    <View style={{ gap: space.md, marginTop: space.lg }}>
      <Pressable onPress={onRatings} accessibilityRole="link" style={({ pressed }) => [styles.box, pressed && { opacity: 0.7 }]}>
        {rated ? (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text v="h2">{score(ratings.average ?? 0)}</Text>
              <Text style={{ color: STAR, fontSize: 11, letterSpacing: 1 }}>★★★★★</Text>
            </View>
            {guestFavourite ? (
              <View style={[styles.stat, styles.middle, { flexDirection: "row", gap: 4, flex: 1.6 }]} accessibilityLabel={t.favouriteLead}>
                <Laurel />
                <Text v="h3" style={{ textAlign: "center", flexShrink: 1 }}>
                  {t.guestFavourite}
                </Text>
                <Laurel flip />
              </View>
            ) : null}
            <View style={[styles.stat, !guestFavourite && styles.middleLeft]}>
              <Text v="h2">{ratings.count}</Text>
              <Text v="tiny">{word}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.newRow}>
            <View style={styles.newStar}>
              <Icon name="star" size={18} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text v="h3">{r.newOnRantio}</Text>
              <Text v="small">{r.newLead}</Text>
            </View>
          </View>
        )}
      </Pressable>

      {ratings.external.length ? (
        <View style={styles.chips}>
          {ratings.external.map((e) => (
            <Pressable key={e.id} onPress={() => WebBrowser.openBrowserAsync(e.url).catch(() => undefined)} style={styles.chip} accessibilityRole="link">
              <Text v="small" color={colors.ink}>
                <Text v="smallMedium">{e.name}</Text> ★ {score(e.score)}
                {e.scale !== 5 ? ` / ${e.scale}` : ""} · {p(r.count, e.count)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {host ? (
        <View style={styles.host}>
          <Avatar name={host.name} size={48} photo={host.photo ? mediaUrl(host.photo) : null} />
          <View style={{ flex: 1 }}>
            <Text v="h3">{f(t.hostedBy, { name: host.name })}</Text>
            <Text v="small">{f(t.hostingSince, { year: String(host.since) })}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: "#fff" },
  stats: { flexDirection: "row", alignItems: "center", paddingVertical: space.lg },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  middle: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingHorizontal: space.sm, justifyContent: "center" },
  middleLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  newRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  newStar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, backgroundColor: "#fff" },
  host: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
