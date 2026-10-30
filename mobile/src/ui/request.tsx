// A booking request from the owner's booking link: accept (with the price the owner
// will charge) or decline. Nothing is booked until the owner accepts.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, TextInput, View } from "react-native";

import { ApiError, type BookingRequestRow, ownerApi } from "@/api";
import { type Currency, formatPrice, isCurrency } from "@/lib/currency";
import { DAY_WEEKDAY, formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, fonts, radius, space } from "@/theme";
import { Button, Card, Problem, Text } from "@/ui/kit";

export function RequestCard({
  req,
  cottage,
  showChatLink,
  onDone,
}: {
  req: BookingRequestRow;
  cottage?: string;
  showChatLink?: boolean;
  onDone: (status: "accepted" | "declined") => void;
}) {
  const { m, lang, f, p } = useT();
  const t = m.dashboard.calendar.requests;
  const router = useRouter();
  const [payout, setPayout] = useState(req.estimate);
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [error, setError] = useState("");
  const currency: Currency = isCurrency(req.currency) ? req.currency : "EUR";

  const answer = async (action: "accept" | "decline") => {
    setBusy(action);
    setError("");
    try {
      if (action === "accept") await ownerApi.acceptRequest(req.id, payout.replace(",", ".") || "0");
      else await ownerApi.declineRequest(req.id);
      onDone(action === "accept" ? "accepted" : "declined");
    } catch (e) {
      setError(e instanceof ApiError && e.body.detail === "taken" ? t.taken : t.failed);
      setBusy("");
    }
  };

  return (
    <Card style={{ gap: space.sm, borderColor: colors.berry, borderWidth: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
        <Text v="h3" style={{ flex: 1 }}>
          {req.guest_name}
        </Text>
        {cottage ? <Text v="small">{cottage}</Text> : null}
      </View>
      <Text v="bodyMedium">
        {formatDate(lang, req.check_in, DAY_WEEKDAY)} – {formatDate(lang, req.check_out, DAY_WEEKDAY)} · {p(m.book.nights, req.nights)}
      </Text>
      <Text v="small">
        {f(t.guests, { adults: req.adults, children: req.children })}
        {req.guest_phone ? (
          <Text v="small" color={colors.lake} onPress={() => Linking.openURL(`tel:${req.guest_phone.replace(/\s/g, "")}`)}>
            {" · "}
            {t.phone}: {req.guest_phone}
          </Text>
        ) : null}
      </Text>
      {req.message ? (
        <Text v="body" style={styles.quote}>
          {req.message}
        </Text>
      ) : null}
      {req.free ? (
        <>
          <Text v="smallMedium" style={{ marginTop: space.xs }}>
            {t.payout}
          </Text>
          <View style={styles.payout}>
            <TextInput
              value={payout}
              onChangeText={(v) => setPayout(v.replace(/[^\d.,]/g, ""))}
              keyboardType="decimal-pad"
              style={styles.payoutInput}
              accessibilityLabel={t.payout}
            />
            <Text v="bodyMedium">{currency}</Text>
          </View>
          <Text v="tiny">{f(t.estimate, { amount: formatPrice(lang, Number(req.estimate), currency) })}</Text>
          <Text v="small">{t.acceptNote}</Text>
        </>
      ) : (
        <Problem text={t.taken} />
      )}
      {error ? <Problem text={error} /> : null}
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", marginTop: space.xs }}>
        {req.free ? <Button label={busy === "accept" ? t.accepting : t.accept} busy={busy === "accept"} disabled={!!busy} onPress={() => answer("accept")} /> : null}
        <Button kind="secondary" label={busy === "decline" ? t.declining : t.decline} busy={busy === "decline"} disabled={!!busy} onPress={() => answer("decline")} />
        {showChatLink ? <Button kind="ghost" label={t.openChat} onPress={() => router.push(`/thread/${req.id}`)} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  quote: { borderLeftWidth: 3, borderLeftColor: colors.line, paddingLeft: space.md, color: colors.soft },
  payout: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space.md },
  payoutInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
});
