import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, guestApi, Offline } from "@/api";
import { CONTACT_EMAIL } from "@/lib/content";
import { COUNTRIES, type Country } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { listedChoices, type ListedOn, MAX_SIGNUP_PHOTOS, TRIAL } from "@/i18n/messages/trial";
import { withPrices } from "@/lib/prices";
import { usePrices } from "@/lib/usePrices";
import { PLACES } from "@/lib/places";
import { deviceName, useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { Button, Icon, Problem, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";
import { openSite } from "@/ui/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NETTIMOKKI = /^https?:\/\/([a-z0-9-]+\.)*nettimokki\.com(\/|$)/i;
// The country the form starts with, from the app's language (English: none chosen yet).
const LANG_COUNTRY: Record<string, Country> = { fi: "FI", sv: "SE", nb: "NO", nn: "NO", da: "DK", is: "IS", et: "EE", lv: "LV", lt: "LT" };

const LONG_SIDE = 2400; // as the listing photos: big enough for any screen, quick to upload

type Errors = Partial<Record<"name" | "email" | "country" | "region" | "nettimokki" | "photos" | "consent" | "code" | "form", string>>;
// After the form: Stripe's card page for the free trial, then whether the card was saved.
type Step = "form" | "checking" | "saved" | "notSaved" | "thanks";

// The sign-up this phone sent last, so the link back from the card page can be told from a stranger's.
const SIGNUP_KEY = "rantio:signup";

/** "List your cottage" inside the app: the same sign-up as on rantio.fi/hosts, with photos,
 *  then a card saved on Stripe's page for the free months (set in the admin). */
export default function ListCottage() {
  // country(): the app's own names (Hermes has no Intl.DisplayNames, so not countryName()).
  const { m, lang, f, country: countryLabel } = useT();
  const t = m.owner.form;
  const prices = usePrices();
  const tr = withPrices(lang, TRIAL[lang], prices);
  const router = useRouter();
  const { signedUp, signedIn, owner, refresh } = useSession();
  // Someone already signed in lists with the address they signed in with: no email code.
  const account = signedIn && owner ? owner : null;
  // rantio://list-cottage?signup=… (the welcome page sends the owner back here)
  const params = useLocalSearchParams<{ signup?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | "">(LANG_COUNTRY[lang] ?? "");
  const [region, setRegion] = useState("");
  const [place, setPlace] = useState("");
  const [count, setCount] = useState(1);
  const [nettimokki, setNettimokki] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [listed, setListed] = useState<ListedOn[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<Step>(params.signup ? "checking" : "form");
  const [submitted, setToken] = useState("");
  // The link's sign-up counts only if this phone sent it (SIGNUP_KEY): a link carrying someone
  // else's sign-up must not get this person's card saved for it.
  const [linked, setLinked] = useState("");
  const token = submitted || linked;
  const [firstName, setFirstName] = useState("");
  // The email check: the address a code went to, the code typed in, and whether the sign-up signed in.
  const [codeFor, setCodeFor] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const codeStep = !account && codeFor !== "" && codeFor === email.trim().toLowerCase();
  const [filled, setFilled] = useState(false);
  if (account && !filled) {
    // Filled in once from the account (during render, so the fields start with it).
    setFilled(true);
    setEmail(account.email);
    if (account.is_host || !account.email.startsWith(`${account.name}@`)) setName(account.name);
  }

  const askNettimokki = country === "FI" && listed.includes("nettimokki");
  const toggleListed = (key: ListedOn) =>
    setListed((now) =>
      now.includes(key) ? now.filter((k) => k !== key) : key === "none" ? ["none"] : [...now.filter((k) => k !== "none"), key],
    );

  const showCard = useCallback((res: { card_saved: boolean; name: string; card_step: boolean }) => {
    if (res.name) setFirstName(res.name);
    setStep(res.card_saved ? "saved" : res.card_step ? "notSaved" : "thanks");
  }, []);
  const checkCard = async (signup: string) => {
    setStep("checking");
    await guestApi.signupCard(signup).then(showCard, () => setStep("notSaved"));
  };

  useEffect(() => {
    // Opened by the link from the welcome page: the screen starts on "checking".
    const signup = params.signup;
    if (!signup) return;
    AsyncStorage.getItem(SIGNUP_KEY)
      .catch(() => null)
      .then((mine) => {
        if (mine !== signup) return setStep("form");
        setLinked(signup);
        return guestApi.signupCard(signup).then(showCard, () => setStep("notSaved"));
      });
  }, [params.signup, showCard]);

  // Stripe's page in a browser sheet; the welcome page opens rantio://list-cottage, which closes it.
  const saveCard = async (url: string, signup: string) => {
    const WebBrowser = await import("expo-web-browser");
    await WebBrowser.openAuthSessionAsync(url, "rantio://list-cottage").catch(() => undefined);
    await checkCard(signup);
  };

  const retryCard = async () => {
    setBusy(true);
    try {
      const res = await guestApi.newCardPage(token);
      if (res.checkout_url) await saveCard(res.checkout_url, token);
      else setStep(res.card_saved ? "saved" : "thanks");
    } catch {
      setErrors({ form: f(tr.welcome.failed, { email: CONTACT_EMAIL }) });
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async () => {
    setErrors((e) => ({ ...e, photos: undefined }));
    let ImagePicker: typeof import("expo-image-picker");
    let Manipulator: typeof import("expo-image-manipulator");
    try {
      ImagePicker = await import("expo-image-picker");
      Manipulator = await import("expo-image-manipulator");
    } catch {
      return setErrors((e) => ({ ...e, photos: tr.photoType }));
    }
    // No permission asked: the system's photo picker hands over only the photos picked.
    const room = MAX_SIGNUP_PHOTOS - photos.length;
    if (room <= 0) return setErrors((e) => ({ ...e, photos: tr.tooManyPhotos }));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets.length) return;
    setPreparing(true);
    const ready: string[] = [];
    for (const a of result.assets.slice(0, room)) {
      try {
        // A JPEG no longer than LONG_SIDE, as the website makes before uploading.
        const ctx = Manipulator.ImageManipulator.manipulate(a.uri);
        if (Math.max(a.width, a.height) > LONG_SIDE) ctx.resize(a.width >= a.height ? { width: LONG_SIDE } : { height: LONG_SIDE });
        const image = await ctx.renderAsync();
        const saved = await image.saveAsync({ compress: 0.82, format: Manipulator.SaveFormat.JPEG });
        ready.push(saved.uri);
      } catch {
        setErrors((e) => ({ ...e, photos: tr.photoType }));
      }
    }
    setPreparing(false);
    setPhotos((now) => [...now, ...ready].slice(0, MAX_SIGNUP_PHOTOS));
  };

  const regions = country
    ? [...PLACES[country]].sort((a, b) => regionLabel(a, country, lang).localeCompare(regionLabel(b, country, lang), lang))
    : [];
  const chosen = country ? PLACES[country].find((r) => r.id === region) : undefined;
  const towns = chosen?.cities.map((c) => c.name) ?? [];
  const close = () => (router.canGoBack() ? router.back() : router.replace("/explore"));
  // Signed in by the sign-up: on to the owner's side, where the cottage is waiting.
  const finish = () => (isOwner ? router.replace("/today") : close());

  const sendCode = async () => {
    setBusy(true);
    try {
      await guestApi.signupEmailCode(email.trim(), name.trim(), lang);
      setCodeFor(email.trim().toLowerCase());
      setEmailCode("");
      setErrors({});
    } catch (err) {
      setErrors(
        err instanceof ApiError && err.status === 429
          ? { form: tr.code.tooMany }
          : err instanceof ApiError && err.status === 400
            ? { email: t.errors.email }
            : { form: err instanceof Offline ? m.app.common.offline : t.errors.network.replace("{email}", CONTACT_EMAIL) },
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const e: Errors = {};
    if (!name.trim()) e.name = t.errors.required;
    if (!EMAIL.test(email.trim())) e.email = email.trim() ? t.errors.email : t.errors.required;
    if (!country) e.country = t.errors.required;
    else if (!region) e.region = t.errors.required;
    if (askNettimokki && nettimokki.trim() && !NETTIMOKKI.test(nettimokki.trim())) e.nettimokki = t.errors.nettimokki;
    if (!photos.length) e.photos = tr.photosRequired;
    if (!consent) e.consent = t.errors.consent;
    setErrors(e);
    if (Object.keys(e).length) return;
    // First a code to the email address; the form goes through once it's typed in.
    if (!account && !codeStep) return sendCode();
    if (!account && emailCode.replace(/\D/g, "").length !== 6) return setErrors({ code: tr.code.wrong });
    setBusy(true);
    try {
      const res = await guestApi.listCottage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        language: lang,
        country,
        region,
        place: place.trim().slice(0, 100),
        cottage_count: count,
        nettimokki_url: askNettimokki ? nettimokki.trim() : "",
        listed_on: listed.join(","),
        message: message.trim(),
        privacy_consent: true,
        source: "app",
        website: "",
        app: 1,
        email_code: emailCode.replace(/\D/g, ""),
        device: deviceName(),
        platform: Platform.OS === "ios" ? "ios" : "android",
      }, photos);
      if (res.app_key) {
        await signedUp(res.app_key);
        setIsOwner(true);
      } else if (account && res.signed_in) {
        await refresh(); // the account is a host now
        setIsOwner(true);
      }
      setToken(res.token);
      AsyncStorage.setItem(SIGNUP_KEY, res.token).catch(() => undefined);
      setFirstName(name.trim().split(" ")[0]);
      if (res.checkout_url) await saveCard(res.checkout_url, res.token);
      else setStep("thanks");
    } catch (err) {
      const detail = err instanceof ApiError && err.status === 400 ? err.body : {};
      setErrors(
        err instanceof ApiError && err.status === 429
          ? { form: t.errors.tooMany }
          : detail.email_code
            ? { code: tr.code.wrong }
            : detail.email
            ? { email: t.errors.email }
            : detail.region
              ? { region: t.errors.required }
              : detail.nettimokki_url
                ? { nettimokki: t.errors.nettimokki }
                : detail.photos
                  ? { photos: String(detail.photos).includes("too_big") ? tr.photoBig : tr.photoType }
                  : { form: err instanceof Offline ? m.app.common.offline : t.errors.network.replace("{email}", CONTACT_EMAIL) },
      );
    } finally {
      setBusy(false);
    }
  };

  if (step !== "form") {
    const [title, lead] =
      step === "saved"
        ? [tr.welcome.title, f(tr.welcome.lead, { name: firstName })]
        : step === "notSaved"
          ? [tr.welcome.notSavedTitle, tr.welcome.notSavedLead]
          : step === "thanks"
            ? [t.successTitle, f(t.success, { name: firstName })]
            : [tr.welcome.checking, ""];
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SheetBar title={m.owner.nav.cta} onClose={close} />
        <View style={styles.done}>
          {step === "checking" ? <ActivityIndicator color={colors.green} /> : <Text style={{ fontSize: 56, lineHeight: 64 }}>{step === "notSaved" ? "💳" : "🏡"}</Text>}
          <Text v="title" style={{ textAlign: "center" }}>
            {title}
          </Text>
          {lead ? (
            <Text v="body" color={colors.soft} style={{ textAlign: "center" }}>
              {lead}
            </Text>
          ) : null}
          {errors.form ? <Problem text={errors.form} /> : null}
          {step === "notSaved" ? (
            <Button label={tr.welcome.retry} busy={busy} onPress={retryCard} style={{ alignSelf: "stretch", marginTop: space.lg }} />
          ) : null}
          {step !== "checking" ? (
            <Button
              kind={step === "notSaved" ? "ghost" : "primary"}
              label={isOwner && step !== "notSaved" ? tr.code.toDashboard : m.app.common.done}
              onPress={finish}
              style={{ alignSelf: "stretch", marginTop: step === "notSaved" ? 0 : space.lg }}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={m.owner.nav.cta} onClose={close} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
          <Text v="title">{m.owner.why.title}</Text>
          <View style={{ gap: space.md }}>
            {withPrices(lang, m.owner.why.items, prices).map((item) => (
              <View key={item.title} style={styles.why}>
                <Icon name="checkmark-circle" size={22} color={colors.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text v="bodyMedium">{item.title}</Text>
                  <Text v="small">{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text v="h3">{t.title}</Text>
            <Text v="small">{t.lead}</Text>
            <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
            <Field
              label={t.email}
              value={email}
              onChangeText={setEmail}
              editable={!account}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <Field label={t.phone} optional={t.optional} value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" />

            <Text v="bodyMedium" style={{ marginTop: space.sm }}>
              {t.region}
            </Text>
            <Text v="smallMedium">{t.country}</Text>
            <View style={styles.chips}>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setCountry(c);
                    setRegion("");
                    setPlace("");
                  }}
                  style={[styles.chip, country === c && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: country === c }}
                >
                  <Text v="smallMedium" color={country === c ? "#fff" : colors.ink}>
                    {countryLabel(c)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.country ? <Text v="small" color={colors.error}>{errors.country}</Text> : null}

            <Text v="smallMedium">{t.regionLabel}</Text>
            {/* The country's regions right here in the form, like the countries above. */}
            {country ? (
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.regionLabel}>
                {regions.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setRegion(r.id);
                      setPlace("");
                    }}
                    style={[styles.chip, region === r.id && styles.chipOn, errors.region && !region ? { borderColor: colors.error } : null]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: region === r.id }}
                  >
                    <Text v="smallMedium" color={region === r.id ? "#fff" : colors.ink}>
                      {regionLabel(r, country, lang)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text v="small" color={colors.faint}>
                {t.regionFirst}
              </Text>
            )}
            {errors.region ? <Text v="small" color={colors.error}>{errors.region}</Text> : null}

            {region ? (
              <>
                <Field label={t.place} optional={t.optional} value={place} onChangeText={setPlace} autoComplete="address-line2" />
                <View style={styles.chips}>
                  {towns.slice(0, 8).map((town) => (
                    <Pressable key={town} onPress={() => setPlace(town)} style={[styles.chip, place === town && styles.chipOn]}>
                      <Text v="small" color={place === town ? "#fff" : colors.ink}>
                        {town}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text v="smallMedium">{t.count}</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setCount(n)} style={[styles.chip, styles.countChip, count === n && styles.chipOn]}>
                  <Text v="smallMedium" color={count === n ? "#fff" : colors.ink}>
                    {n === 5 ? "5+" : n}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text v="smallMedium">{tr.listedOn}</Text>
            <Text v="small">{tr.listedHint}</Text>
            <View style={styles.chips}>
              {listedChoices(country).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => toggleListed(key)}
                  style={[styles.chip, listed.includes(key) && styles.chipOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: listed.includes(key) }}
                >
                  <Text v="smallMedium" color={listed.includes(key) ? "#fff" : colors.ink}>
                    {tr.listedOptions[key]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {askNettimokki ? (
              <Field
                label={t.nettimokki}
                optional={t.optional}
                value={nettimokki}
                onChangeText={setNettimokki}
                placeholder="https://www.nettimokki.com/…"
                keyboardType="url"
                autoCapitalize="none"
                error={errors.nettimokki}
              />
            ) : null}
            <Field label={t.message} optional={t.optional} value={message} onChangeText={setMessage} multiline maxLength={2000} />

            <Text v="bodyMedium" style={{ marginTop: space.sm }}>
              {tr.photos}
            </Text>
            <Text v="small">{tr.photosHint}</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={uri} style={styles.photo}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <Pressable
                    onPress={() => setPhotos((now) => now.filter((u) => u !== uri))}
                    style={styles.photoRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`${tr.removePhoto} ${i + 1}`}
                    hitSlop={8}
                  >
                    <Icon name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_SIGNUP_PHOTOS ? (
                <Pressable
                  onPress={addPhotos}
                  disabled={preparing}
                  style={[styles.photo, styles.photoAdd, errors.photos ? { borderColor: colors.error } : null]}
                  accessibilityRole="button"
                  accessibilityLabel={tr.addPhotos}
                >
                  {preparing ? <ActivityIndicator color={colors.green} /> : <Icon name="add" size={28} color={colors.green} />}
                  <Text v="tiny" style={{ textAlign: "center" }}>
                    {tr.addPhotos}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {errors.photos ? <Text v="small" color={colors.error}>{errors.photos}</Text> : null}

            <Pressable onPress={() => setConsent(!consent)} style={styles.consent} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
              <Icon name={consent ? "checkbox" : "square-outline"} size={24} color={errors.consent ? colors.error : colors.green} />
              <Text v="small" style={{ flex: 1 }}>
                {t.consent}
              </Text>
            </Pressable>
            <Button kind="ghost" small label={t.privacyLink} onPress={() => openSite(`/${lang}/privacy`)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
            {errors.consent ? <Text v="small" color={colors.error}>{errors.consent}</Text> : null}
            {errors.form ? <Problem text={errors.form} /> : null}
            {codeStep ? (
              <View style={styles.trial}>
                <Text v="small">{f(tr.code.sent, { email: email.trim() })}</Text>
                <Field
                  label={tr.code.label}
                  value={emailCode}
                  onChangeText={(v) => setEmailCode(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  error={errors.code}
                  style={{ fontSize: 22, letterSpacing: 6 }}
                />
                <Button kind="ghost" small label={tr.code.resend} onPress={sendCode} disabled={busy} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
              </View>
            ) : (
              <View style={styles.trial}>
                <Text v="smallMedium" color={colors.green}>
                  {tr.badge}
                </Text>
                <Text v="small">{tr.cardNote}</Text>
              </View>
            )}
            <Button label={busy ? t.sending : codeStep ? tr.code.confirm : tr.submit} busy={busy} disabled={preparing} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );
}

const styles = StyleSheet.create({
  why: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  countChip: { minWidth: 48, alignItems: "center" },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  consent: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  photo: { width: 92, height: 92, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.ground },
  photoAdd: { alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line, padding: 4 },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 42, 48, 0.75)",
  },
  trial: { gap: 4, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.ground },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
});
