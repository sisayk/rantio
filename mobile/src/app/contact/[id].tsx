import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, guestApi, Offline } from "@/api";
import { getListing, listingName } from "@/lib/listings";
import { usePrefs } from "@/state/prefs";
import { formatRange } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Stepper } from "@/ui/controls";
import { Field } from "@/ui/form";
import { Button, Icon, Problem, Text } from "@/ui/kit";
import { RangeCalendar } from "@/ui/range-calendar";
import { ModalFoot, SheetBar } from "@/ui/screen";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Message the owner" from a cottage page; the answer comes by email and in Messages. */
export default function Contact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = getListing(id);
  const { m, lang, p } = useT();
  const { addChat } = usePrefs();
  const router = useRouter();
  const c = m.guest.contact;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [guests, setGuests] = useState(0);
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
        guests: guests || null,
        website: "",
      });
      addChat({ token, listing: l.id, at: new Date().toISOString(), kind: "enquiry" });
      router.replace(`/chat/${token}`);
    } catch (e) {
      setProblem(e instanceof Offline ? m.app.common.offline : e instanceof ApiError && e.status === 429 ? c.tooMany : c.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={c.title} onClose={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Text v="h2">{listingName(m.listingNames, l)}</Text>
          <Text v="small">{c.lead}</Text>
          <Field label={c.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={tried ? errors.name : null} />
          <Field
            label={c.email}
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            hint={c.emailHint}
            error={tried ? errors.email : null}
          />
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
          <View style={styles.guests}>
            <View>
              <Text v="smallMedium">{c.guests}</Text>
              <Text v="small">{guests ? p(m.guest.units.guests, guests) : c.optional}</Text>
            </View>
            <Stepper value={guests} max={l.guests} onChange={setGuests} label={c.guests} />
          </View>
          <Field label={c.message} value={body} onChangeText={setBody} placeholder={c.placeholder} multiline error={tried ? errors.body : null} />
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
