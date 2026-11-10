import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, guestApi, Offline } from "@/api";
import { getListing, listingName } from "@/lib/listings";
import { useAnsweredBy } from "@/state/answeredBy";
import { usePrefs } from "@/state/prefs";
import { formatRange } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Stepper } from "@/ui/controls";
import { Field } from "@/ui/form";
import { Button, Icon, Problem, Text } from "@/ui/kit";
import { RangeCalendar } from "@/ui/range-calendar";
import { ModalFoot, SheetBar } from "@/ui/screen";
import { SenderCard, useSender } from "@/ui/sender";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Message the owner" from a cottage page; the answer comes by email and in Messages.
 *  AI writing help turns a few words into the message (the guest checks it and sends it).
 *  An example stay has no owner yet: the screen says the Rantio team answers. */
export default function Contact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = getListing(id);
  const { m, lang, p } = useT();
  const { addChat } = usePrefs();
  const router = useRouter();
  const answeredBy = useAnsweredBy(id);
  const c = answeredBy === "owner" ? m.guest.contact : { ...m.guest.contact, ...m.guest.contact.example };
  const sender = useSender();
  const { name, email } = sender;
  const [body, setBody] = useState("");
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [writing, setWriting] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "done" | "failed" | "off">("idle");
  const [dates, setDates] = useState<[string | null, string | null]>([null, null]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  if (!l) return null;
  const errors = {
    name: !name.trim() ? m.book.errors.required : null,
    email: !email.trim() ? m.book.errors.required : !EMAIL.test(email.trim()) ? m.book.errors.email : null,
    body: !body.trim() ? m.book.errors.required : null,
  };
  const ok = !errors.name && !errors.email && !errors.body;

  const send = async () => {
    setTried(true);
    if (!ok) return;
    setBusy(true);
    setProblem(null);
    try {
      const [check_in, check_out] = dates;
      const { token } = await guestApi.enquire({
        listing: l.id,
        name: name.trim(),
        email: email.trim(),
        lang,
        body: body.trim(),
        check_in: check_in && check_out ? check_in : null,
        check_out: check_in && check_out ? check_out : null,
        adults: adults || null,
        children: adults ? children : null,
        website: "",
      });
      sender.remember();
      addChat({ token, listing: l.id, at: new Date().toISOString(), kind: "enquiry" });
      router.replace(`/chat/${token}`);
    } catch (e) {
      setProblem(e instanceof Offline ? m.app.common.offline : e instanceof ApiError && e.status === 429 ? c.tooMany : c.failed);
    } finally {
      setBusy(false);
    }
  };

  const [checkIn, checkOut] = dates[0] && dates[1] ? dates : [null, null];

  const help = async () => {
    setWriting(true);
    try {
      const { draft } = await guestApi.draftEnquiry({
        listing: l.id,
        cottage: listingName(m.listingNames, l),
        place: `${l.city}, ${l.country}`,
        lang,
        name: name.trim(),
        check_in: checkIn,
        check_out: checkOut,
        adults: adults || null,
        children: adults ? children : null,
        draft: body.trim(),
      });
      setBody(draft);
      setAiState("done");
    } catch (e) {
      setAiState(e instanceof ApiError && e.status === 503 ? "off" : "failed");
    } finally {
      setWriting(false);
    }
  };

  const aiLine =
    aiState === "done" ? c.aiNote : aiState === "off" ? c.aiOff : aiState === "failed" ? c.aiFailed : body.trim() ? null : c.aiHint;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={c.title} onClose={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Text v="h2">{listingName(m.listingNames, l)}</Text>
          <Text v="small">{c.lead}</Text>
          {sender.usingKnown ? (
            <SenderCard name={name} email={email} hint={c.emailHint} onChange={sender.change} />
          ) : (
            <>
              <Field label={c.name} value={name} onChangeText={sender.setName} autoComplete="name" textContentType="name" error={tried ? errors.name : null} />
              <Field
                label={c.email}
                value={email}
                onChangeText={sender.setEmail}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoCapitalize="none"
                hint={c.emailHint}
                error={tried ? errors.email : null}
              />
            </>
          )}
          <View style={{ gap: 6 }}>
            <Text v="smallMedium">
              {c.checkIn} – {c.checkOut} <Text v="small">({c.optional})</Text>
            </Text>
            <Pressable onPress={() => setPicking(true)} style={styles.pick} accessibilityRole="button">
              <Icon name="calendar-outline" size={20} />
              <Text v="body" style={{ flex: 1 }} color={dates[0] && dates[1] ? colors.ink : colors.faint}>
                {dates[0] && dates[1] ? formatRange(lang, dates[0], dates[1]) : m.guest.datePicker.addDates}
              </Text>
              <Icon name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          </View>
          <View style={{ gap: space.md }}>
            <Text v="smallMedium">
              {c.guests} <Text v="small">({adults ? p(m.guest.units.guests, adults + children) : c.optional})</Text>
            </Text>
            <View style={styles.guests}>
              <Text v="body">{c.adults}</Text>
              <Stepper
                value={adults}
                min={children ? 1 : 0}
                max={l.guests - children}
                onChange={setAdults}
                label={c.adults}
              />
            </View>
            <View style={styles.guests}>
              <Text v="body">{c.children}</Text>
              <Stepper
                value={children}
                max={Math.max(0, l.guests - Math.max(adults, 1))}
                onChange={(n) => {
                  // Children travel with at least one adult.
                  if (n > 0 && !adults) setAdults(1);
                  setChildren(n);
                }}
                label={c.children}
              />
            </View>
          </View>
          <View style={{ gap: space.sm }}>
            <Field
              label={c.message}
              value={body}
              onChangeText={(t) => {
                setBody(t);
                if (aiState !== "idle") setAiState("idle");
              }}
              placeholder={c.placeholder}
              multiline
              error={tried ? errors.body : null}
            />
            <Pressable
              onPress={help}
              disabled={writing}
              style={({ pressed }) => [styles.ai, pressed && { backgroundColor: colors.greenTint }]}
              accessibilityRole="button"
              accessibilityState={{ busy: writing }}
            >
              {writing ? <ActivityIndicator size="small" color={colors.green} /> : <Icon name="sparkles" size={18} color={colors.green} />}
              <Text v="smallMedium" color={colors.green}>
                {writing ? c.aiWorking : body.trim() ? c.aiImprove : c.aiWrite}
              </Text>
            </Pressable>
            {aiLine ? (
              <Text v="tiny" color={aiState === "failed" || aiState === "off" ? colors.error : undefined}>
                {aiLine}
              </Text>
            ) : null}
          </View>
          {problem ? <Problem text={problem} /> : null}
          <Button label={busy ? c.sending : c.send} busy={busy} onPress={send} icon="send" />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={m.guest.datePicker.title} onClose={() => setPicking(false)} />
          <ScrollView contentContainerStyle={{ padding: space.lg }}>
            <RangeCalendar lang={lang} start={dates[0]} end={dates[1]} onChange={(a, b) => setDates([a, b])} months={12} />
          </ScrollView>
          <ModalFoot style={styles.foot}>
            <Button kind="ghost" label={m.guest.datePicker.clear} onPress={() => setDates([null, null])} />
            <Button label={m.guest.datePicker.done} onPress={() => setPicking(false)} />
          </ModalFoot>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space.md },
  guests: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ai: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: "#fff",
  },
  foot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
