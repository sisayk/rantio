// Ratings in the app: stars, a cottage's reviews and its scores on other sites (as on rantio.fi).
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Ratings, ReviewRow } from "@/api";
import { REVIEWS } from "@/i18n/messages/reviews";
import { formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { SiteIcon } from "@/ui/host";
import { Avatar, Button, Pill, Section, Text } from "@/ui/kit";

const FEW = 3;
export const STAR = "#e39a2f";

export function useScore() {
  const { lang } = useT();
  return (n: number) => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <Text style={{ fontSize: size, lineHeight: size + 4, letterSpacing: 1 }} accessibilityElementsHidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ color: i <= Math.round(value) ? STAR : colors.line }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

export function ReviewCard({ r, host }: { r: ReviewRow; host: string }) {
  const { lang, f, p } = useT();
  const t = REVIEWS[lang];
  return (
    <View style={styles.review}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Avatar name={r.name || "?"} size={36} />
        <View style={{ flex: 1 }}>
          <Text v="smallMedium">{r.name}</Text>
          <Text v="tiny">{f(t.stayed, { month: formatDate(lang, `${r.stayed}-15`, { month: "long", year: "numeric" }) })}</Text>
        </View>
      </View>
      <View accessible accessibilityLabel={p(t.page.star, r.rating)}>
        <Stars value={r.rating} />
      </View>
      {r.comment ? <Text v="body">{r.comment}</Text> : null}
      {r.reply ? (
        <View style={styles.reply}>
          <Text v="smallMedium">{f(t.reply, { host: host || "Rantio" })}</Text>
          <Text v="small" color={colors.ink}>
            {r.reply}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A cottage's ratings: the average, the newest reviews and its scores on other sites. */
export function RatingsBlock({ ratings, host }: { ratings: Ratings; host: string }) {
  const { lang, f, p } = useT();
  const t = REVIEWS[lang];
  const score = useScore();
  const [all, setAll] = useState(false);
  const shown = all ? ratings.reviews : ratings.reviews.slice(0, FEW);
  const has = ratings.count > 0 && ratings.average !== null;
  return (
    <Section title={has ? `★ ${score(ratings.average ?? 0)} · ${p(t.count, ratings.count)}` : t.title}>
      {has && ratings.categories ? (
        <View style={{ gap: 6, marginBottom: space.md }}>
          {(["cleanliness", "location", "value"] as const).map((k) =>
            ratings.categories?.[k] != null ? (
              <View key={k} style={styles.part}>
                <Text v="small" color={colors.ink} style={{ flex: 1 }}>
                  {t.categories[k]}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${((ratings.categories[k] ?? 0) / 5) * 100}%` }]} />
                </View>
                <Text v="smallMedium" style={{ width: 28, textAlign: "right" }}>
                  {score(ratings.categories[k] ?? 0)}
                </Text>
              </View>
            ) : null,
          )}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <Pill label={t.newOnRantio} tone="green" />
          <Text v="small">{t.newLead}</Text>
        </View>
      )}
      {shown.map((r) => (
        <ReviewCard key={r.id} r={r} host={host} />
      ))}
      {ratings.reviews.length > FEW ? (
        <Button small kind="secondary" label={all ? t.showFewer : t.showAll} onPress={() => setAll(!all)} style={{ alignSelf: "flex-start", marginTop: space.sm }} />
      ) : null}
      {ratings.external.length ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Text v="h3">{t.elsewhere}</Text>
          {ratings.external.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => WebBrowser.openBrowserAsync(e.url).catch(() => undefined)}
              accessibilityRole="link"
              accessibilityLabel={f(t.seeOn, { site: e.name })}
              style={({ pressed }) => [styles.external, pressed && { opacity: 0.7 }]}
            >
              <SiteIcon channel={e.site} label={e.name} />
              <Text v="small" style={{ flex: 1, textAlign: "right" }}>
                {f(t.outOf, { score: score(e.score), scale: e.scale })} · {p(t.count, e.count)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text v="tiny" style={{ marginTop: space.md }}>
        {t.verified}
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  review: { gap: 6, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  reply: { padding: space.md, borderRadius: radius.sm, backgroundColor: colors.ground, gap: 2 },
  part: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bar: { width: 90, height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.ink },
  external: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.ground },
});
