import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, type BookingLinkInfo, guestApi, Offline, type Ratings, type StayQuote } from "@/api";
import { REVIEWS } from "@/i18n/messages/reviews";
import { DEFAULT_LONG_POLICY, DEFAULT_POLICY, isLongPolicy, isPolicy } from "@/lib/cancellation";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { usePrefs } from "@/state/prefs";
import { daysBetween, formatRange } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { CancellationInfo } from "@/ui/cancellation";
import { Stepper } from "@/ui/controls";
import { Field } from "@/ui/form";
import { Button, Card, Empty, Loading, Pill, Problem, Section, Text } from "@/ui/kit";
import { RatingsBlock, STAR, useScore } from "@/ui/ratings";
import { RangeCalendar } from "@/ui/range-calendar";
import { PageBar } from "@/ui/screen";
import { SenderCard, useSender } from "@/ui/sender";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A guest with an owner's own booking link asks for dates; the owner accepts or declines. */
export default function BookingRequest() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { m, lang, f, p, country } = useT();
  const b = m.book;
  const { addChat } = usePrefs();
  const router = useRouter();
  const [info, setInfo] = useState<BookingLinkInfo | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [dates, setDates] = useState<[string | null, string | null]>([null, null]);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const sender = useSender();
  const { name, email } = sender;
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState(b.form.messageDefault);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const load = useCallback(() => {
    guestApi
      .bookingLink(token)
      .then((i) => {
        setInfo(i);
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
  }, [token]);
  useEffect(load, [load]);

  // The stay's price from the server: each night's own price (seasons, weekends, smart pricing), discounts and cleaning.
  const [quote, setQuote] = useState<{ key: string; q: StayQuote } | null>(null);
  useEffect(() => {
    const [a, z] = dates;
    if (!a || !z) return;
    let live = true;
    guestApi.quote(token, a, z).then(
      (q) => {
        if (live) setQuote({ key: `${a}|${z}`, q });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [token, dates]);

  const taken = useMemo(() => {
    const busyRanges = info?.busy ?? [];
    return (day: string) => busyRanges.some(([a, z]) => a <= day && day < z);
  }, [info]);

  if (state === "loading") return <Frame><Loading /></Frame>;
  if (state === "missing") return <Frame><Empty icon="link-outline" title={b.errors.notFound} /></Frame>;
  if (state === "error" || !info) return <Frame><View style={{ padding: space.xl }}><Problem text={b.errors.load} retry={load} retryLabel={m.dashboard.retry} /></View></Frame>;

  const currency: Currency = isCurrency(info.currency) ? info.currency : "EUR";
  const [start, end] = dates;
  const nights = start && end ? daysBetween(start, end) : 0;
  const price = (v: number) => formatPrice(lang, v, currency);
  const q = quote && quote.key === `${start}|${end}` ? quote.q : null;
  const each = q ? q.nights.map((n) => Number(n.price)) : [];
  const even = !q || each.every((x) => x === each[0]);
  const stay = q ? Number(q.subtotal) : Number(info.price_per_night) * nights;
  const cleaning = q ? Number(q.cleaning_fee) : Number(info.cleaning_fee);
  const total = q ? Number(q.total) : stay + cleaning;
  const nightsLabel = even ? f(b.price.nights, { price: price(q ? each[0] : Number(info.price_per_night)), nights: p(b.nights, nights) }) : p(b.nights, nights);
  const errors = {
    name: !name.trim() ? b.errors.required : null,
    email: !email.trim() ? b.errors.required : !EMAIL.test(email.trim()) ? b.errors.email : null,
  };

  const send = async () => {
    setTried(true);
    setProblem(null);
    if (!start || !end) return setProblem(b.form.noDates);
    if (nights < info.min_nights) return setProblem(b.errors.min_nights);
    if (errors.name || errors.email) return;
    setBusy(true);
    try {
      const r = await guestApi.requestBooking(token, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        lang,
        check_in: start,
        check_out: end,
        adults,
        children,
        body: body.trim() || b.form.messageDefault,
        website: "",
      });
      sender.remember();
      addChat({ token: r.token, listing: info.listing_slug, at: new Date().toISOString(), kind: "request" });
      router.replace(`/chat/${r.token}`);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.body.detail ?? "") : "";
      setProblem(
        e instanceof Offline
          ? m.app.common.offline
          : e instanceof ApiError && e.status === 429
            ? b.errors.tooMany
            : (b.errors as Record<string, string>)[code] ?? b.errors.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!info.open) {
    return (
      <Frame title={info.name}>
        <Empty icon="lock-closed-outline" title={b.closed.title} lead={f(b.closed.body, { host: info.host })} />
      </Frame>
    );
  }

  return (
    <Frame title={info.name}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          <Text v="title">{info.name}</Text>
          <Text v="small">{[info.municipality, country(info.country)].filter(Boolean).join(", ")}</Text>
          <Text v="bodyMedium" style={{ marginTop: space.sm }}>
            {f(b.host, { name: info.host })} · {f(b.perNight, { price: price(Number(info.price_per_night)) })}
          </Text>
          {info.ratings ? <RatingLine ratings={info.ratings} /> : null}

          <Section title={b.dates}>
            <Text v="small" style={{ marginBottom: space.md }}>
              {!start ? b.pickIn : !end ? b.pickOut : `${formatRange(lang, start, end)} · ${p(b.nights, nights)}`}
              {info.min_nights > 1 ? ` · ${p(b.minNights, info.min_nights)}` : ""}
            </Text>
            <RangeCalendar lang={lang} start={start} end={end} onChange={(a, z) => setDates([a, z])} takenNight={taken} months={12} firstMonth={info.today} />
            {start ? <Button small kind="ghost" label={b.clear} onPress={() => setDates([null, null])} style={{ alignSelf: "flex-start", marginTop: space.sm }} /> : null}
          </Section>

          <Section title={b.guests}>
            <Text v="small">{f(b.maxGuests, { n: info.max_guests })}</Text>
            <View style={styles.stepRow}>
              <Text v="body">{b.adults}</Text>
              <Stepper value={adults} min={1} max={Math.max(1, info.max_guests - children)} onChange={setAdults} label={b.adults} />
            </View>
            <View style={styles.stepRow}>
              <Text v="body">{b.children}</Text>
              <Stepper value={children} max={Math.max(0, info.max_guests - adults)} onChange={setChildren} label={b.children} />
            </View>
          </Section>

          {nights ? (
            <Card style={{ marginTop: space.xl, gap: space.sm }}>
              <View style={styles.priceRow}>
                <Text v="body">{nightsLabel}</Text>
                <Text v="body">{price(stay)}</Text>
              </View>
              {q && Number(q.discount) ? (
                <View style={styles.priceRow}>
                  <Text v="body">{f(b.price.discount, { pct: q.discount_percent })}</Text>
                  <Text v="body" color={colors.green}>
                    −{price(Number(q.discount))}
                  </Text>
                </View>
              ) : null}
              {cleaning ? (
                <View style={styles.priceRow}>
                  <Text v="body">{b.price.cleaning}</Text>
                  <Text v="body">{price(cleaning)}</Text>
                </View>
              ) : null}
              <View style={[styles.priceRow, styles.total]}>
                <Text v="h3">{b.price.total}</Text>
                <Text v="h3">{price(total)}</Text>
              </View>
              <Text v="tiny">{b.price.note}</Text>
            </Card>
          ) : null}

          <Card style={{ marginTop: space.lg }}>
            <CancellationInfo
              policy={isPolicy(info.cancellation_policy) ? info.cancellation_policy : DEFAULT_POLICY}
              longPolicy={isLongPolicy(info.long_stay_policy) ? info.long_stay_policy : DEFAULT_LONG_POLICY}
              checkIn={start}
              checkOut={end}
              nights={nights}
              today={info.today}
              time={info.check_in_from}
            />
          </Card>

          <Section title={b.form.title}>
            <View style={{ gap: space.lg }}>
              {sender.usingKnown ? (
                <SenderCard name={name} email={email} hint={b.form.emailNote} onChange={sender.change} />
              ) : (
                <>
                  <Field label={b.form.name} value={name} onChangeText={sender.setName} autoComplete="name" error={tried ? errors.name : null} />
                  <Field
                    label={b.form.email}
                    value={email}
                    onChangeText={sender.setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    hint={b.form.emailNote}
                    error={tried ? errors.email : null}
                  />
                </>
              )}
              <Field label={b.form.phone} optional={b.form.optional} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
              <Field label={b.form.message} value={body} onChangeText={setBody} multiline />
              {problem ? <Problem text={problem} /> : null}
              <Button label={busy ? b.form.sending : b.form.send} busy={busy} onPress={send} />
            </View>
          </Section>
          {info.ratings ? <RatingsBlock ratings={info.ratings} host={info.host} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Frame>
  );
}

/** "★ 4.8 · 12 reviews" under the name, or "New on Rantio". */
function RatingLine({ ratings }: { ratings: Ratings }) {
  const { lang, p } = useT();
  const score = useScore();
  const t = REVIEWS[lang];
  if (!ratings.count || ratings.average === null) return <Pill label={t.newOnRantio} tone="green" style={{ marginTop: space.sm }} />;
  return (
    <Text v="smallMedium" style={{ marginTop: space.xs }}>
      <Text style={{ color: STAR }}>★</Text> {score(ratings.average)} · {p(t.count, ratings.count)}
    </Text>
  );
}

function Frame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  priceRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  total: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.sm },
});
