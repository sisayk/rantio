import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, mediaUrl, ownerApi, type PaymentMethod } from "@/api";
import { ACCOUNT } from "@/i18n/messages/account";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { DeleteAccountButton } from "@/ui/account";
import { Field } from "@/ui/form";
import { Avatar, Button, Card, Icon, Section, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";

const PHOTO_SIDE = 640;
const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover" };

/** Account: profile photo, name and phone, the payment method Rantio's fees are charged to, delete. */
export default function Account() {
  const { m, lang, f } = useT();
  const t = ACCOUNT[lang].profile;
  const { owner, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState(owner?.name ?? "");
  const [phone, setPhone] = useState(owner?.phone ?? "");
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
    try {
      await ownerApi.updateMe({ name: name.trim(), phone: phone.trim() });
      await refresh();
      setSaved(true);
    } catch (e) {
      const code = e instanceof ApiError ? String((e.body.phone as string[] | undefined)?.[0] ?? "") : "";
      setError(code === "taken" ? t.phoneTaken : code === "invalid" ? t.invalidPhone : t.failed);
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
                disabled={!name.trim() || (name.trim() === owner.name && phone.trim() === (owner.phone ?? ""))}
                onPress={save}
              />
            </View>
          </Section>

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
