import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, type ExternalRating, ownerApi, type OwnerReviews, type ReviewRow } from "@/api";
import { REVIEWS, type ReviewsText } from "@/i18n/messages/reviews";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { SiteIcon } from "@/ui/host";
import { Button, Card, Loading, Pill, Problem, Section, Text } from "@/ui/kit";
import { ReviewCard, Stars, useScore } from "@/ui/ratings";
import { PageBar } from "@/ui/screen";

function ratingError(t: ReviewsText, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const first = (k: string) => (Array.isArray(b[k]) ? String((b[k] as unknown[])[0]) : "");
  const code = first("url") || first("score");
  return code in t.owner.errors ? t.owner.errors[code as keyof ReviewsText["owner"]["errors"]] : t.owner.errors.other;
}

/** One property → Reviews and ratings: guests' reviews with replies, and scores from other sites. */
export default function ListingReviews() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, lang, p } = useT();
  const t = REVIEWS[lang];
  const score = useScore();
  const [data, setData] = useState<OwnerReviews | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .reviews(pk)
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [pk]);
  useEffect(load, [load]);

  const setReview = (row: ReviewRow) => setData((d) => (d ? { ...d, reviews: d.reviews.map((x) => (x.id === row.id ? row : x)) } : d));
  const setExternal = (list: ExternalRating[]) => setData((d) => (d ? { ...d, external: list } : d));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={t.owner.title} />
      {!data ? (
        failed ? (
          <View style={{ padding: space.xl }}>
            <Problem text={m.dashboard.error} retry={load} retryLabel={m.dashboard.retry} />
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
            <Text v="small">{t.owner.lead}</Text>
            <Section title={t.title}>
              {data.count && data.average !== null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm }}>
                  <Stars value={data.average} size={18} />
                  <Text v="h3">
                    {score(data.average)} · {p(t.count, data.count)}
                  </Text>
                </View>
              ) : (
                <Text v="small">{t.owner.none}</Text>
              )}
              {data.reviews.map((r) => (
                <OwnerReview key={r.id} row={r} onChange={setReview} />
              ))}
            </Section>
            <Elsewhere cottage={pk} data={data} onChange={setExternal} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function OwnerReview({ row, onChange }: { row: ReviewRow; onChange: (row: ReviewRow) => void }) {
  const { lang } = useT();
  const t = REVIEWS[lang];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(row.reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await ownerApi.replyToReview(row.id, text.trim()));
      setEditing(false);
    } catch {
      setError(t.owner.errors.other);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <ReviewCard r={{ ...row, reply: editing ? "" : row.reply }} host={t.owner.yourReply} />
      {row.hidden ? <Pill label={t.owner.hidden} tone="error" style={{ marginBottom: space.sm }} /> : null}
      {editing ? (
        <View style={{ gap: space.sm, marginBottom: space.md }}>
          <Field label={t.owner.yourReply} value={text} onChangeText={setText} placeholder={t.owner.replyPlaceholder} multiline maxLength={1000} error={error || null} />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button small label={t.owner.save} busy={busy} onPress={save} />
            <Button small kind="ghost" label={t.owner.cancel} onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <Button small kind="secondary" label={row.reply ? t.owner.editReply : t.owner.reply} onPress={() => setEditing(true)} style={{ alignSelf: "flex-start", marginBottom: space.md }} />
      )}
    </View>
  );
}

function Elsewhere({ cottage, data, onChange }: { cottage: number; data: OwnerReviews; onChange: (list: ExternalRating[]) => void }) {
  const { lang, f, p } = useT();
  const t = REVIEWS[lang];
  const score = useScore();
  const [url, setUrl] = useState("");
  const [value, setValue] = useState("");
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const row = await ownerApi.addRating(cottage, url.trim(), value.replace(",", "."), Number(count));
      onChange([...data.external.filter((x) => x.site !== row.site), row].sort((a, b) => a.site.localeCompare(b.site)));
      setUrl("");
      setValue("");
      setCount("");
    } catch (e) {
      setError(ratingError(t, e instanceof ApiError ? e.body : null));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await ownerApi.removeRating(id);
      onChange(data.external.filter((x) => x.id !== id));
    } catch {
      setError(t.owner.errors.other);
    }
  };

  return (
    <Section title={t.elsewhere}>
      <Text v="small" style={{ marginBottom: space.md }}>
        {t.owner.elsewhereLead}
      </Text>
      {data.external.map((e) => (
        <View key={e.id} style={styles.external}>
          <SiteIcon channel={e.site} label={e.name} />
          <Text v="small" style={{ flex: 1, textAlign: "right" }}>
            {f(t.outOf, { score: score(e.score), scale: e.scale })} · {p(t.count, e.count)}
          </Text>
          <Button small kind="ghost" label={t.owner.remove} onPress={() => remove(e.id)} />
        </View>
      ))}
      <Card style={{ gap: space.md, marginTop: space.sm }}>
        <Field
          label={t.owner.url}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.airbnb.fi/rooms/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={error || null}
        />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label={t.owner.score} value={value} onChangeText={setValue} placeholder="4.9" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t.owner.count} value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ""))} placeholder="87" keyboardType="number-pad" />
          </View>
        </View>
        <Button small label={t.owner.add} busy={busy} disabled={!url.trim() || !value.trim() || !count} onPress={add} style={{ alignSelf: "flex-start" }} />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  external: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.ground,
  },
});
