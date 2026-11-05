import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, StyleSheet, Switch, View } from "react-native";

import { mediaUrl, ownerApi, type OwnerDetails, type PaymentMethod } from "@/api";
import { ACCOUNT } from "@/i18n/messages/account";
import { pushState, type PushState, registerForPush, turnPushOff } from "@/state/push";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { DeleteAccountButton } from "@/ui/account";
import { type SettingsSection, useAccountForm } from "@/ui/accountForm";
import { Chip } from "@/ui/controls";
import { CountryField } from "@/ui/countryField";
import { Field } from "@/ui/form";
import { showDob, typeDob } from "@/lib/dateOfBirth";
import { Avatar, Button, Card, Icon, Text } from "@/ui/kit";
import { MenuDivider, MenuRow, SettingsPage } from "@/ui/menu";

const PHOTO_SIDE = 640;
// The details each page shows, so a mistake elsewhere is still pointed out above Save.
const PERSONAL_FIELDS = ["name", "phone", "legal_first_name", "legal_last_name", "date_of_birth", "address_line", "postal_code", "city",
  "address_country", "postal_line", "postal_postal_code", "postal_city", "postal_country", "emergency_name", "emergency_phone"];
const PAYMENT_FIELDS = ["payout_holder", "payout_iban", "payout_bic"];
const BUSINESS_FIELDS = ["account_type", "company_name", "business_type", "business_id", "trading_name", "website", "legal_rep_name",
  "legal_rep_role", "beneficial_owners", "reservations_contact"];
const TAX_FIELDS = ["business_id", "vat_id", "tax_country", "tax_id", "date_of_birth"];
const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover" };
const SECTIONS: SettingsSection[] = ["personal", "security", "payments", "business", "taxes", "notifications"];

/** One Account settings page. Each shows its part of the owner's details and saves them all. */
export default function AccountSection() {
  const { section: raw } = useLocalSearchParams<{ section: string }>();
  const section = (SECTIONS.includes(raw as SettingsSection) ? raw : "personal") as SettingsSection;
  const { lang } = useT();
  const s = ACCOUNT[lang].settings;
  const form = useAccountForm();
  const titles: Record<SettingsSection, [string, string?]> = {
    personal: [s.personal],
    security: [s.security],
    payments: [s.payments, s.paymentsLead],
    business: [s.business, s.businessLead],
    taxes: [s.taxes, s.taxesLead],
    notifications: [s.notifications],
  };
  const [title, lead] = titles[section];

  if (!form.owner) return <SettingsPage title={title}>{null}</SettingsPage>;
  return (
    <SettingsPage title={title} lead={lead}>
      {section === "personal" ? <Personal form={form} /> : null}
      {section === "security" ? <Security form={form} /> : null}
      {section === "payments" ? <Payments form={form} /> : null}
      {section === "business" ? <Business form={form} /> : null}
      {section === "taxes" ? <Taxes form={form} /> : null}
      {section === "notifications" ? <Notifications /> : null}
    </SettingsPage>
  );
}

type Form = ReturnType<typeof useAccountForm>;
type Det = OwnerDetails;

/** Field mistakes show under their fields; the line above Save only names what this page can't show. */
function SaveButton({ form, fields }: { form: Form; fields: string[] }) {
  const { lang } = useT();
  const t = ACCOUNT[lang].profile;
  const bad = Object.keys(form.fieldErrors);
  const message = bad.length && bad.every((k) => fields.includes(k)) ? "" : form.error;
  return (
    <View style={{ gap: space.sm, marginTop: space.xl }}>
      {message ? (
        <Text v="small" color={colors.error}>
          {message}
        </Text>
      ) : null}
      <Button
        label={form.saved && !form.busy ? t.saved : t.save}
        icon={form.saved && !form.busy ? "checkmark" : undefined}
        busy={form.busy}
        disabled={!form.name.trim()}
        onPress={form.save}
      />
    </View>
  );
}

function Heading({ title, lead }: { title: string; lead?: string }) {
  return (
    <View style={{ marginTop: space.xl, gap: 2 }}>
      <Text v="h2">{title}</Text>
      {lead ? <Text v="small">{lead}</Text> : null}
    </View>
  );
}

/** Day first with the dashes added while typing: 02-07-1983. */
function DobField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const { lang } = useT();
  return (
    <Field
      label={label}
      value={showDob(value)}
      onChangeText={(v) => onChange(typeDob(v))}
      placeholder={ACCOUNT[lang].settings.dobPlaceholder}
      keyboardType="number-pad"
      textContentType="birthdate"
      maxLength={10}
      error={error}
    />
  );
}

function Address({ det, setDet, postal }: { det: Det; setDet: (d: Det) => void; postal?: boolean }) {
  const { lang } = useT();
  const d = ACCOUNT[lang].details;
  const k = postal
    ? ({ line: "postal_line", code: "postal_postal_code", city: "postal_city", country: "postal_country" } as const)
    : ({ line: "address_line", code: "postal_code", city: "city", country: "address_country" } as const);
  return (
    <View style={{ gap: space.md }}>
      <Field label={d.street} value={det[k.line]} onChangeText={(v) => setDet({ ...det, [k.line]: v })} textContentType={postal ? undefined : "fullStreetAddress"} maxLength={200} />
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ width: 120 }}>
          <Field label={d.postal} value={det[k.code]} onChangeText={(v) => setDet({ ...det, [k.code]: v })} textContentType={postal ? undefined : "postalCode"} maxLength={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={d.city} value={det[k.city]} onChangeText={(v) => setDet({ ...det, [k.city]: v })} textContentType={postal ? undefined : "addressCity"} maxLength={100} />
        </View>
      </View>
      <CountryField label={d.country} value={det[k.country]} onChange={(c) => setDet({ ...det, [k.country]: c })} />
    </View>
  );
}

function Personal({ form }: { form: Form }) {
  const { m, lang } = useT();
  const t = ACCOUNT[lang].profile;
  const d = ACCOUNT[lang].details;
  const h = ACCOUNT[lang].host;
  const { owner, det, setDet, fieldErrors } = form;
  const [photoBusy, setPhotoBusy] = useState(false);
  if (!owner) return null;
  const host = owner.is_host;
  const person = !det || det.account_type !== "company";

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
      await form.refresh();
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
      await form.refresh();
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
      ActionSheetIOS.showActionSheetWithOptions({ options: choices, cancelButtonIndex: choices.length - 1, destructiveButtonIndex: owner.photo ? 2 : undefined }, (i) => void run(i));
    } else {
      Alert.alert(t.photo, undefined, choices.slice(0, -1).map((text, i) => ({ text, onPress: () => void run(i) })));
    }
  };

  return (
    <>
      <Pressable onPress={photoMenu} style={styles.photo} accessibilityRole="button" accessibilityLabel={owner.photo ? t.changePhoto : t.addPhoto}>
        <Avatar name={owner.name} size={112} photo={owner.photo ? mediaUrl(owner.photo) : null} />
        <View style={styles.camera}>
          <Icon name="camera" size={18} color="#fff" />
        </View>
      </Pressable>
      <Button small kind="ghost" label={photoBusy ? "…" : owner.photo ? t.changePhoto : t.addPhoto} onPress={photoMenu} style={{ alignSelf: "center" }} />

      <View style={{ gap: space.md, marginTop: space.md }}>
        <Field label={t.name} value={form.name} onChangeText={form.setName} autoComplete="name" textContentType="name" maxLength={120} />
        {host && det && person ? (
          <>
            <View style={{ gap: 2, marginTop: space.sm }}>
              <Text v="h3">{h.legal}</Text>
              <Text v="tiny">{h.legalLead}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Field label={h.firstName} value={det.legal_first_name} onChangeText={(v) => setDet({ ...det, legal_first_name: v })} textContentType="givenName" maxLength={80} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={h.lastName} value={det.legal_last_name} onChangeText={(v) => setDet({ ...det, legal_last_name: v })} textContentType="familyName" maxLength={80} />
              </View>
            </View>
          </>
        ) : null}
        <View style={{ gap: 6 }}>
          <Text v="smallMedium">{t.email}</Text>
          <Text v="body">{owner.email}</Text>
          <Text v="tiny">{t.emailHint}</Text>
        </View>
        <Field
          label={t.phone}
          hint={t.phoneHint}
          value={form.phone}
          onChangeText={form.setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={40}
          error={fieldErrors.phone || null}
        />
        {host && det && person ? (
          <DobField label={h.dob} value={det.date_of_birth} onChange={(v) => setDet({ ...det, date_of_birth: v })} error={fieldErrors.date_of_birth || null} />
        ) : null}
      </View>

      {det ? (
        <>
          <Heading title={d.address} />
          <View style={{ marginTop: space.md, gap: space.md }}>
            <Address det={det} setDet={setDet} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Text v="body" style={{ flex: 1 }}>
                {h.postalSame}
              </Text>
              <Switch value={det.postal_same} onValueChange={(v) => setDet({ ...det, postal_same: v })} trackColor={{ true: colors.green, false: colors.line }} />
            </View>
            {!det.postal_same ? (
              <>
                <Text v="h3">{h.postal}</Text>
                <Address det={det} setDet={setDet} postal />
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {host && det && person ? (
        <>
          <Heading title={h.emergency} lead={h.emergencyLead} />
          <View style={{ marginTop: space.md, gap: space.md }}>
            <Field label={h.emergencyName} value={det.emergency_name} onChangeText={(v) => setDet({ ...det, emergency_name: v })} maxLength={120} />
            <Field label={h.emergencyPhone} value={det.emergency_phone} onChangeText={(v) => setDet({ ...det, emergency_phone: v })} keyboardType="phone-pad" maxLength={40} error={fieldErrors.emergency_phone || null} />
          </View>
        </>
      ) : null}

      <SaveButton form={form} fields={PERSONAL_FIELDS} />
    </>
  );
}

function Security({ form }: { form: Form }) {
  const { lang } = useT();
  const s = ACCOUNT[lang].settings;
  const router = useRouter();
  const owner = form.owner;
  if (!owner) return null;
  return (
    <>
      <Text v="h2">{s.signsIn}</Text>
      <MenuRow icon="mail-outline" label={s.emailCode} detail={owner.email} />
      {owner.phone ? <MenuRow icon="chatbubble-outline" label={s.smsCode} detail={owner.phone} /> : null}
      <MenuDivider />
      <View style={{ marginTop: space.lg }}>
        <DeleteAccountButton onDeleted={() => router.replace("/explore")} />
      </View>
    </>
  );
}

function Payments({ form }: { form: Form }) {
  const { lang, f } = useT();
  const t = ACCOUNT[lang].profile;
  const d = ACCOUNT[lang].details;
  const { det, setDet, fieldErrors } = form;
  const [payment, setPayment] = useState<{ available: boolean; method: PaymentMethod | null } | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    ownerApi
      .paymentMethod()
      .then(setPayment)
      .catch(() => setPayment({ available: false, method: null }));
  }, []);
  useFocusEffect(load);

  const change = async () => {
    setPaying(true);
    try {
      const { url } = await ownerApi.newPaymentPage();
      const WebBrowser = await import("expo-web-browser");
      // Stripe's page; the page it comes back to opens rantio://account, which closes the sheet.
      await WebBrowser.openAuthSessionAsync(url, "rantio://account").catch(() => undefined);
      load();
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
    <>
      {payment?.available ? (
        <>
          <Heading title={t.payment} lead={t.paymentLead} />
          <Card style={{ gap: space.md, marginTop: space.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Icon name={method?.kind === "bank" ? "business-outline" : "card-outline"} size={26} />
              <View style={{ flex: 1 }}>
                <Text v="bodyMedium">{methodLine}</Text>
                {method?.exp_month && method.exp_year ? (
                  <Text v="small">{f(t.expires, { month: String(method.exp_month).padStart(2, "0"), year: String(method.exp_year).slice(-2) })}</Text>
                ) : null}
              </View>
            </View>
            <Button kind="secondary" small label={method ? t.change : t.add} busy={paying} onPress={change} style={{ alignSelf: "flex-start" }} />
          </Card>
        </>
      ) : null}

      {det ? (
        <>
          <Heading title={d.payout} lead={d.payoutLead} />
          <View style={{ gap: space.md, marginTop: space.md }}>
            <Field label={d.holder} value={det.payout_holder} onChangeText={(v) => setDet({ ...det, payout_holder: v })} maxLength={160} />
            <Field
              label={d.iban}
              hint={det.has_payout ? f(d.ibanSaved, { iban: det.payout_iban }) : undefined}
              value={form.iban}
              onChangeText={(v) => form.setIban(v.toUpperCase())}
              placeholder={det.has_payout ? det.payout_iban : "FI00 1234 5600 0007 85"}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={42}
              error={fieldErrors.payout_iban || null}
            />
            <Field label={d.bic} optional={d.optional} value={det.payout_bic} onChangeText={(v) => setDet({ ...det, payout_bic: v.toUpperCase() })} autoCapitalize="characters" maxLength={11} error={fieldErrors.payout_bic || null} />
          </View>
          <SaveButton form={form} fields={PAYMENT_FIELDS} />
        </>
      ) : null}
    </>
  );
}

function Business({ form }: { form: Form }) {
  const { lang } = useT();
  const d = ACCOUNT[lang].details;
  const h = ACCOUNT[lang].host;
  const { det, setDet, fieldErrors } = form;
  if (!det) return null;
  const owners = det.beneficial_owners;
  const setOwner = (i: number, patch: Partial<Det["beneficial_owners"][number]>) =>
    setDet({ ...det, beneficial_owners: owners.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <>
      <Text v="h2">{d.who}</Text>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        {(["private", "company"] as const).map((k) => (
          <Chip key={k} label={d[k]} on={det.account_type === k} onPress={() => setDet({ ...det, account_type: k })} />
        ))}
      </View>

      {det.account_type === "company" ? (
        <>
          <View style={{ gap: space.md, marginTop: space.lg }}>
            <Field label={d.companyName} value={det.company_name} onChangeText={(v) => setDet({ ...det, company_name: v })} maxLength={160} error={fieldErrors.company_name || null} />
            <Text v="smallMedium">{h.businessType}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {(Object.keys(h.types) as (keyof typeof h.types)[]).map((k) => (
                <Chip key={k} label={h.types[k]} on={det.business_type === k} onPress={() => setDet({ ...det, business_type: k })} />
              ))}
            </View>
            <Field label={d.businessId} value={det.business_id} onChangeText={(v) => setDet({ ...det, business_id: v })} placeholder="1234567-8" autoCapitalize="characters" maxLength={30} error={fieldErrors.business_id || null} />
            <Field label={h.tradingName} optional={d.optional} value={det.trading_name} onChangeText={(v) => setDet({ ...det, trading_name: v })} maxLength={160} />
            <Field label={h.website} optional={d.optional} value={det.website} onChangeText={(v) => setDet({ ...det, website: v })} placeholder="https://" autoCapitalize="none" keyboardType="url" maxLength={300} error={fieldErrors.website || null} />
          </View>

          <Heading title={h.legalRep} lead={h.legalRepLead} />
          <View style={{ gap: space.md, marginTop: space.md }}>
            <Field label={h.legalRepName} value={det.legal_rep_name} onChangeText={(v) => setDet({ ...det, legal_rep_name: v })} maxLength={160} />
            <Field label={h.legalRepRole} value={det.legal_rep_role} onChangeText={(v) => setDet({ ...det, legal_rep_role: v })} maxLength={80} />
          </View>

          <Heading title={h.owners} lead={h.ownersLead} />
          <View style={{ gap: space.md, marginTop: space.md }}>
            {owners.map((bo, i) => (
              <Card key={i} style={{ gap: space.sm }}>
                <Field label={h.ownerName} value={bo.name} onChangeText={(v) => setOwner(i, { name: v })} maxLength={160} />
                <View style={{ flexDirection: "row", gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <DobField label={h.dob} value={bo.date_of_birth} onChange={(v) => setOwner(i, { date_of_birth: v })} />
                  </View>
                  <View style={{ width: 100 }}>
                    <Field label={h.ownerShare} value={bo.share == null ? "" : String(bo.share)} keyboardType="decimal-pad" onChangeText={(v) => setOwner(i, { share: v === "" ? null : Number(v.replace(",", ".")) })} maxLength={6} />
                  </View>
                </View>
                <Button small kind="ghost" label={h.removeOwner} onPress={() => setDet({ ...det, beneficial_owners: owners.filter((_, j) => j !== i) })} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
              </Card>
            ))}
            {fieldErrors.beneficial_owners ? (
              <Text v="small" color={colors.error}>
                {fieldErrors.beneficial_owners}
              </Text>
            ) : null}
            {owners.length < 10 ? (
              <Button small kind="secondary" icon="add" label={h.addOwner} onPress={() => setDet({ ...det, beneficial_owners: [...owners, { name: "", date_of_birth: "", country: det.address_country || "FI", share: null }] })} style={{ alignSelf: "flex-start" }} />
            ) : null}
          </View>
        </>
      ) : null}

      <Heading title={h.reservations} lead={h.reservationsLead} />
      <View style={{ gap: space.md, marginTop: space.md }}>
        <Field label={h.contactName} value={det.reservations_contact.name ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, name: v } })} maxLength={160} />
        <Field label={h.contactEmail} value={det.reservations_contact.email ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, email: v } })} keyboardType="email-address" autoCapitalize="none" maxLength={160} error={fieldErrors.reservations_contact || null} />
        <Field label={h.contactPhone} value={det.reservations_contact.phone ?? ""} onChangeText={(v) => setDet({ ...det, reservations_contact: { ...det.reservations_contact, phone: v } })} keyboardType="phone-pad" maxLength={40} />
      </View>
      <SaveButton form={form} fields={BUSINESS_FIELDS} />
    </>
  );
}

function Taxes({ form }: { form: Form }) {
  const { lang, f } = useT();
  const d = ACCOUNT[lang].details;
  const h = ACCOUNT[lang].host;
  const s = ACCOUNT[lang].settings;
  const { det, setDet, fieldErrors } = form;
  if (!det) return null;
  return (
    <>
      {det.account_type === "company" ? (
        <View style={{ gap: space.md }}>
          <Field label={d.businessId} value={det.business_id} onChangeText={(v) => setDet({ ...det, business_id: v })} placeholder="1234567-8" autoCapitalize="characters" maxLength={30} error={fieldErrors.business_id || null} />
          <Field label={d.vatId} optional={d.optional} value={det.vat_id} onChangeText={(v) => setDet({ ...det, vat_id: v })} placeholder="FI12345678" autoCapitalize="characters" maxLength={20} error={fieldErrors.vat_id || null} />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <Text v="small">{h.taxLead}</Text>
          <CountryField label={s.taxCountry} value={det.tax_country} onChange={(c) => setDet({ ...det, tax_country: c })} error={fieldErrors.tax_country || null} />
          <Field
            label={(det.tax_country || "FI") === "FI" ? s.hetu : h.tax}
            hint={det.has_tax_id ? f(h.taxSaved, { tin: det.tax_id }) : h.taxSecure}
            value={form.tin}
            onChangeText={(v) => form.setTin(v.toUpperCase())}
            placeholder={det.has_tax_id ? det.tax_id : (det.tax_country || "FI") === "FI" ? "131052-308T" : ""}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            error={
              fieldErrors.tax_id && (det.tax_country || "FI") === "FI" ? s.hetuInvalid : fieldErrors.tax_id || fieldErrors.date_of_birth || null
            }
          />
        </View>
      )}
      <SaveButton form={form} fields={TAX_FIELDS} />
    </>
  );
}

function Notifications() {
  const { m } = useT();
  const [push, setPush] = useState<PushState | null>(null);
  useFocusEffect(
    useCallback(() => {
      pushState()
        .then(setPush)
        .catch(() => setPush("unavailable"));
    }, []),
  );
  if (!push) return null;
  return (
    <>
      <MenuRow
        icon="notifications-outline"
        label={m.app.menu.notifications}
        detail={push === "blocked" ? m.app.menu.notificationsBlocked : push === "unavailable" ? undefined : m.app.menu.notificationsLead}
        right={
          push === "blocked" ? (
            <Button small kind="secondary" label={m.app.menu.openSettings} onPress={() => Linking.openSettings()} />
          ) : push === "unavailable" ? undefined : (
            <Switch
              value={push === "on"}
              onValueChange={async (on) => {
                setPush(on ? "on" : "off"); // the switch moves at once; the result follows
                setPush(await (on ? registerForPush(true) : turnPushOff()).catch(() => (on ? ("off" as const) : ("on" as const))));
              }}
              trackColor={{ true: colors.green, false: colors.line }}
              thumbColor="#ffffff"
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: "center" },
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
