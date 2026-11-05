import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

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
  const h = ACCOUNT[lang].host;
  const { owner, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState(owner?.name ?? "");
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [det, setDet] = useState<OwnerDetails | null>(withDefaults(owner?.details));
  const [iban, setIban] = useState("");
  const [tin, setTin] = useState("");
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

  // The saved profile can be from an older version; read the current details once on opening.
  const [fresh, setFresh] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (fresh || !owner) return;
      ownerApi
        .me()
        .then((me) => {
          setFresh(true);
          if (me.details) setDet(withDefaults(me.details));
        })
        .catch(() => {});
    }, [fresh, owner]),
  );

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
        // Read-only parts and the masked numbers stay out; a new IBAN or tax number only if typed.
        const { has_payout: _a, payout_iban: _b, has_tax_id: _c, tax_id: _d, missing: _e, ...rest } = det;
        void [_a, _b, _c, _d, _e];
        details = { ...rest, ...(iban.trim() ? { payout_iban: iban } : {}), ...(tin.trim() ? { tax_id: tin } : {}) };
      }
      const me = await ownerApi.updateMe({ name: name.trim(), phone: phone.trim(), details });
      if (me.details) setDet(withDefaults(me.details));
      setIban("");
      setTin("");
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

          {owner.is_host && det ? (
            <Card style={{ marginTop: space.lg, gap: space.sm, backgroundColor: det.missing.length ? colors.berryTint : colors.greenTint }}>
              <Text v="h3">{h.readyTitle}</Text>
              <Text v="small">{h.readyLead}</Text>
              {det.missing.length ? (
                <Text v="smallMedium">
                  {h.stillNeeded} {det.missing.map((k) => h.missing[k]).join(", ")}
                </Text>
              ) : (
                <Text v="smallMedium" color={colors.green}>
                  ✓ {h.ready}
                </Text>
              )}
            </Card>
          ) : null}

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
                      <Text v="smallMedium">{h.businessType}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                        {(Object.keys(h.types) as (keyof typeof h.types)[]).map((k) => (
                          <Chip key={k} label={h.types[k]} on={det.business_type === k} onPress={() => setDet({ ...det, business_type: k })} />
                        ))}
                      </View>
                      <Field label={h.tradingName} optional={d.optional} value={det.trading_name} onChangeText={(v) => setDet({ ...det, trading_name: v })} maxLength={160} />
                      <Field label={h.website} optional={d.optional} value={det.website} onChangeText={(v) => setDet({ ...det, website: v })} placeholder="https://" autoCapitalize="none" keyboardType="url" maxLength={300} error={fieldErrors.website || null} />
                      <Text v="h3" style={{ marginTop: space.sm }}>{h.legalRep}</Text>
                      <Text v="tiny">{h.legalRepLead}</Text>
                      <Field label={h.legalRepName} value={det.legal_rep_name} onChangeText={(v) => setDet({ ...det, legal_rep_name: v })} maxLength={160} />
                      <Field label={h.legalRepRole} value={det.legal_rep_role} onChangeText={(v) => setDet({ ...det, legal_rep_role: v })} maxLength={80} />
                      <Text v="h3" style={{ marginTop: space.sm }}>{h.owners}</Text>
                      <Text v="tiny">{h.ownersLead}</Text>
                      {det.beneficial_owners.map((bo, i) => (
                        <Card key={i} style={{ gap: space.sm }}>
                          <Field label={h.ownerName} value={bo.name} onChangeText={(v) => setDet({ ...det, beneficial_owners: det.beneficial_owners.map((x, j) => (j === i ? { ...x, name: v } : x)) })} maxLength={160} />
                          <View style={{ flexDirection: "row", gap: space.md }}>
                            <View style={{ flex: 1 }}>
                              <Field label={h.dob} value={bo.date_of_birth} placeholder="1980-12-31" keyboardType="numbers-and-punctuation" onChangeText={(v) => setDet({ ...det, beneficial_owners: det.beneficial_owners.map((x, j) => (j === i ? { ...x, date_of_birth: v } : x)) })} maxLength={10} />
                            </View>
                            <View style={{ width: 100 }}>
                              <Field label={h.ownerShare} value={bo.share == null ? "" : String(bo.share)} keyboardType="decimal-pad" onChangeText={(v) => setDet({ ...det, beneficial_owners: det.beneficial_owners.map((x, j) => (j === i ? { ...x, share: v === "" ? null : Number(v.replace(",", ".")) } : x)) })} maxLength={6} />
                            </View>
                          </View>
                          <Button small kind="ghost" label={h.removeOwner} onPress={() => setDet({ ...det, beneficial_owners: det.beneficial_owners.filter((_, j) => j !== i) })} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
                        </Card>
                      ))}
                      {fieldErrors.beneficial_owners ? <Text v="small" color={colors.error}>{fieldErrors.beneficial_owners}</Text> : null}
                      {det.beneficial_owners.length < 10 ? (
                        <Button small kind="secondary" icon="add" label={h.addOwner} onPress={() => setDet({ ...det, beneficial_owners: [...det.beneficial_owners, { name: "", date_of_birth: "", country: det.address_country || "FI", share: null }] })} style={{ alignSelf: "flex-start" }} />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text v="h3">{h.legal}</Text>
                      <Text v="tiny">{h.legalLead}</Text>
                      <Field label={h.firstName} value={det.legal_first_name} onChangeText={(v) => setDet({ ...det, legal_first_name: v })} textContentType="givenName" maxLength={80} />
                      <Field label={h.lastName} value={det.legal_last_name} onChangeText={(v) => setDet({ ...det, legal_last_name: v })} textContentType="familyName" maxLength={80} />
                      <Field label={h.dob} value={det.date_of_birth} placeholder="1980-12-31" keyboardType="numbers-and-punctuation" onChangeText={(v) => setDet({ ...det, date_of_birth: v })} maxLength={10} error={fieldErrors.date_of_birth || null} />
                      <Text v="h3" style={{ marginTop: space.sm }}>{h.tax}</Text>
                      <Text v="tiny">{h.taxLead}</Text>
                      <Field
                        label={h.tax}
                        hint={det.has_tax_id ? f(h.taxSaved, { tin: det.tax_id }) : h.taxSecure}
                        value={tin}
                        onChangeText={(v) => setTin(v.toUpperCase())}
                        placeholder={det.has_tax_id ? det.tax_id : "131052-308T"}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={30}
                        error={fieldErrors.tax_id || null}
                      />
                      <Text v="h3" style={{ marginTop: space.sm }}>{h.emergency}</Text>
                      <Text v="tiny">{h.emergencyLead}</Text>
                      <Field label={h.emergencyName} value={det.emergency_name} onChangeText={(v) => setDet({ ...det, emergency_name: v })} maxLength={120} />
                      <Field label={h.emergencyPhone} value={det.emergency_phone} onChangeText={(v) => setDet({ ...det, emergency_phone: v })} keyboardType="phone-pad" maxLength={40} error={fieldErrors.emergency_phone || null} />
                    </>
                  )}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <Text v="body" style={{ flex: 1 }}>
                      {h.postalSame}
                    </Text>
                    <Switch value={det.postal_same} onValueChange={(v) => setDet({ ...det, postal_same: v })} trackColor={{ true: colors.green, false: colors.line }} />
                  </View>
                  {!det.postal_same ? (
                    <>
                      <Text v="h3">{h.postal}</Text>
                      <Field label={d.street} value={det.postal_line} onChangeText={(v) => setDet({ ...det, postal_line: v })} maxLength={200} />
                      <View style={{ flexDirection: "row", gap: space.md }}>
                        <View style={{ width: 120 }}>
                          <Field label={d.postal} value={det.postal_postal_code} onChangeText={(v) => setDet({ ...det, postal_postal_code: v })} maxLength={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Field label={d.city} value={det.postal_city} onChangeText={(v) => setDet({ ...det, postal_city: v })} maxLength={100} />
                        </View>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                        {COUNTRIES.map((c) => (
                          <Chip key={c} label={country(c)} on={det.postal_country === c} onPress={() => setDet({ ...det, postal_country: c })} />
                        ))}
                      </ScrollView>
                    </>
                  ) : null}
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
                  <Text v="h3" style={{ marginTop: space.md }}>{h.reservations}</Text>
                  <Text v="tiny">{h.reservationsLead}</Text>
                  <Field label={h.contactName} value={det.reservations_contact.name ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, name: v } })} maxLength={160} />
                  <Field label={h.contactEmail} value={det.reservations_contact.email ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, email: v } })} keyboardType="email-address" autoCapitalize="none" maxLength={160} error={fieldErrors.reservations_contact || null} />
                  <Field label={h.contactPhone} value={det.reservations_contact.phone ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, phone: v } })} keyboardType="phone-pad" maxLength={40} />
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

/** A profile saved by an older app (or server) lacks the newer lists; give them safe empty values. */
function withDefaults(d: OwnerDetails | null | undefined): OwnerDetails | null {
  if (!d) return null;
  return {
    ...d,
    missing: d.missing ?? [],
    beneficial_owners: d.beneficial_owners ?? [],
    reservations_contact: d.reservations_contact ?? {},
    postal_same: d.postal_same ?? true,
  };
}
