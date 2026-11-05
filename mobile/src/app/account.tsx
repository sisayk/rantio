import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, mediaUrl, ownerApi, type OwnerDetails, type PaymentMethod } from "@/api";
import { ACCOUNT } from "@/i18n/messages/account";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { DeleteAccountButton } from "@/ui/account";
import { Field } from "@/ui/form";
import { Chip } from "@/ui/controls";
import { Avatar, Button, Card, Icon, Section, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";

const PHOTO_SIDE = 640;
const COUNTRIES = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT", "DE", "AT", "CH", "NL", "BE", "FR", "ES", "IT", "PL", "GB", "IE", "US"];
const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover" };

/** Account: profile photo, name and phone, the payment method Rantio's fees are charged to, delete. */
export default function Account() {
  const { m, lang, f, country } = useT();
  const t = ACCOUNT[lang].profile;
  const d = ACCOUNT[lang].details;
  const { owner, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState(owner?.name ?? "");
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [det, setDet] = useState<OwnerDetails | null>(owner?.details ?? null);
  const [iban, setIban] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [payment, setPayment] = useState<{ available: boolean; method: PaymentMethod | null } | null>(null);
  const [paying, setPaying] = useState(false);

  const loadPayment = useCallback(() => {
    if (!owner?.is_host) return;
    ownerApi
      .paymentMethod()
      .then(setPayment)
      .catch(() => setPayment({ available: false, method: null }));
  }, [owner?.is_host]);
  useFocusEffect(loadPayment);

  if (!owner) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <PageBar title={t.title} />
      </View>
    );
  }

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    setFieldErrors({});
    try {
      let details: Partial<OwnerDetails> | undefined;
      if (det) {
        const { has_payout: _h, payout_iban: _i, ...rest } = det;
        void _h;
        void _i;
        details = { ...rest, ...(iban.trim() ? { payout_iban: iban } : {}) };
      }
      const me = await ownerApi.updateMe({ name: name.trim(), phone: phone.trim(), details });
      if (me.details) setDet(me.details);
      setIban("");
      await refresh();
      setSaved(true);
    } catch (e) {
      const body = e instanceof ApiError ? e.body : {};
      const code = String((body.phone as string[] | undefined)?.[0] ?? "");
      const bad: Record<string, string> = {};
      for (const [k, v] of Object.entries((body.details ?? {}) as Record<string, string[]>)) {
        bad[k] = v[0] === "required" ? d.errors.required : v[0] === "too_long" ? d.errors.too_long : d.errors.invalid;
      }
      setFieldErrors(bad);
      setError(code === "taken" ? t.phoneTaken : code === "invalid" ? t.invalidPhone : Object.keys(bad).length ? "" : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (from: "camera" | "library") => {
    const ImagePicker = await import("expo-image-picker");
    const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
    const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(m.app.listing.permission, undefined, [
        { text: m.app.common.cancel, style: "cancel" },
        { text: m.app.menu.openSettings, onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const options = { mediaTypes: ["images" as const], quality: 1, exif: false, allowsEditing: true, aspect: [1, 1] as [number, number] };
    const res = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets.length) return;
    const a = res.assets[0];
    setPhotoBusy(true);
    try {
      // A small square JPEG, drawn again so the camera's data (GPS) doesn't travel with it.
      const ctx = ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > PHOTO_SIDE) ctx.resize(a.width >= a.height ? { width: PHOTO_SIDE } : { height: PHOTO_SIDE });
      const image = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      await ownerApi.setPhoto(image.uri);
      await refresh();
    } catch {
      Alert.alert(t.failed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await ownerApi.removePhoto();
      await refresh();
    } catch {
      Alert.alert(t.failed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const photoMenu = () => {
    const choices = [m.listings.photos.camera, m.app.listing.library, ...(owner.photo ? [t.removePhoto] : []), m.app.common.cancel];
    const run = (i: number) => (i === 0 ? pickPhoto("camera") : i === 1 ? pickPhoto("library") : owner.photo && i === 2 ? removePhoto() : undefined);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: choices, cancelButtonIndex: choices.length - 1, destructiveButtonIndex: owner.photo ? 2 : undefined },
        (i) => void run(i),
      );
    } else {
      Alert.alert(t.photo, undefined, choices.slice(0, -1).map((text, i) => ({ text, onPress: () => void run(i) })));
    }
  };

  const changePayment = async () => {
    setPaying(true);
    try {
      const { url } = await ownerApi.newPaymentPage();
      const WebBrowser = await import("expo-web-browser");
      // Stripe's page; the page it comes back to opens rantio://account, which closes the sheet.
      await WebBrowser.openAuthSessionAsync(url, "rantio://account").catch(() => undefined);
      loadPayment();
    } catch {
      Alert.alert(t.failed);
    } finally {
      setPaying(false);
    }
  };

  const method = payment?.method;
  const methodLine = method
    ? method.kind === "bank"
      ? f(t.bank, { last4: method.last4 })
      : f(t.card, { brand: BRANDS[method.brand] ?? (method.brand ? method.brand[0].toUpperCase() + method.brand.slice(1) : "Card"), last4: method.last4 })
    : t.none;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={t.title} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={photoMenu} style={styles.photo} accessibilityRole="button" accessibilityLabel={owner.photo ? t.changePhoto : t.addPhoto}>
            <Avatar name={owner.name} size={112} photo={owner.photo ? mediaUrl(owner.photo) : null} />
            <View style={styles.camera}>
              <Icon name="camera" size={18} color="#fff" />
            </View>
          </Pressable>
          <Button small kind="ghost" label={photoBusy ? "…" : owner.photo ? t.changePhoto : t.addPhoto} onPress={photoMenu} style={{ alignSelf: "center" }} />

          <Section title={t.title}>
            <View style={{ gap: space.md }}>
              <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={120} />
              <Field
                label={t.phone}
                hint={t.phoneHint}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={40}
              />
              <View style={{ gap: 6 }}>
                <Text v="smallMedium">{t.email}</Text>
                <Text v="body">{owner.email}</Text>
                <Text v="tiny">{t.emailHint}</Text>
              </View>
              {error ? <Text v="small" color={colors.error}>{error}</Text> : null}
              <Button
                label={saved && !busy ? t.saved : t.save}
                icon={saved && !busy ? "checkmark" : undefined}
                busy={busy}
                disabled={!name.trim()}
                onPress={save}
              />
            </View>
          </Section>

          {det ? (
            <>
              <Section title={d.who}>
                <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.md }}>
                  {(["private", "company"] as const).map((k) => (
                    <Chip key={k} label={d[k]} on={det.account_type === k} onPress={() => (setDet({ ...det, account_type: k }), setSaved(false))} />
                  ))}
                </View>
                <View style={{ gap: space.md }}>
                  {det.account_type === "company" ? (
                    <>
                      <Field label={d.companyName} value={det.company_name} onChangeText={(v) => setDet({ ...det, company_name: v })} maxLength={160} error={fieldErrors.company_name || null} />
                      <Field label={d.businessId} value={det.business_id} onChangeText={(v) => setDet({ ...det, business_id: v })} placeholder="1234567-8" autoCapitalize="characters" maxLength={30} error={fieldErrors.business_id || null} />
                      <Field label={d.vatId} optional={d.optional} value={det.vat_id} onChangeText={(v) => setDet({ ...det, vat_id: v })} placeholder="FI12345678" autoCapitalize="characters" maxLength={20} error={fieldErrors.vat_id || null} />
                    </>
                  ) : null}
                  <Text v="h3" style={{ marginTop: space.sm }}>
                    {d.address}
                  </Text>
                  <Field label={d.street} value={det.address_line} onChangeText={(v) => setDet({ ...det, address_line: v })} textContentType="fullStreetAddress" maxLength={200} />
                  <View style={{ flexDirection: "row", gap: space.md }}>
                    <View style={{ width: 120 }}>
                      <Field label={d.postal} value={det.postal_code} onChangeText={(v) => setDet({ ...det, postal_code: v })} textContentType="postalCode" maxLength={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={d.city} value={det.city} onChangeText={(v) => setDet({ ...det, city: v })} textContentType="addressCity" maxLength={100} />
                    </View>
                  </View>
                  <Text v="smallMedium">{d.country}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                    {COUNTRIES.map((c) => (
                      <Chip key={c} label={country(c)} on={det.address_country === c} onPress={() => setDet({ ...det, address_country: c })} />
                    ))}
                  </ScrollView>
                </View>
              </Section>

              <Section title={d.payout}>
                <Text v="small" style={{ marginBottom: space.md }}>
                  {d.payoutLead}
                </Text>
                <View style={{ gap: space.md }}>
                  <Field label={d.holder} value={det.payout_holder} onChangeText={(v) => setDet({ ...det, payout_holder: v })} maxLength={160} />
                  <Field
                    label={d.iban}
                    hint={det.has_payout ? f(d.ibanSaved, { iban: det.payout_iban }) : undefined}
                    value={iban}
                    onChangeText={(v) => setIban(v.toUpperCase())}
                    placeholder={det.has_payout ? det.payout_iban : "FI00 1234 5600 0007 85"}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={42}
                    error={fieldErrors.payout_iban || null}
                  />
                  <Field label={d.bic} optional={d.optional} value={det.payout_bic} onChangeText={(v) => setDet({ ...det, payout_bic: v.toUpperCase() })} autoCapitalize="characters" maxLength={11} error={fieldErrors.payout_bic || null} />
                  <Button label={saved && !busy ? t.saved : t.save} icon={saved && !busy ? "checkmark" : undefined} busy={busy} disabled={!name.trim()} onPress={save} />
                </View>
              </Section>
            </>
          ) : null}

          {owner.is_host && payment?.available ? (
            <Section title={t.payment}>
              <Text v="small" style={{ marginBottom: space.md }}>
                {t.paymentLead}
              </Text>
              <Card style={{ gap: space.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <Icon name={method?.kind === "bank" ? "business-outline" : "card-outline"} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text v="bodyMedium">{methodLine}</Text>
                    {method?.exp_month && method.exp_year ? (
                      <Text v="small">{f(t.expires, { month: String(method.exp_month).padStart(2, "0"), year: String(method.exp_year).slice(-2) })}</Text>
                    ) : null}
                  </View>
                </View>
                <Button kind="secondary" small label={method ? t.change : t.add} busy={paying} onPress={changePayment} style={{ alignSelf: "flex-start" }} />
              </Card>
            </Section>
          ) : null}

          <View style={{ marginTop: space.xxl }}>
            <DeleteAccountButton onDeleted={() => router.replace("/explore")} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: "center", marginTop: space.md },
  camera: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
