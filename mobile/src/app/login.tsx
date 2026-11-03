import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, Offline, ownerApi, type SignInTo } from "@/api";
import { usePrefs } from "@/state/prefs";
import { registerForPush } from "@/state/push";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, fonts, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { Button, Logo, Problem, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";
import { openSite } from "@/ui/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Calling codes for the phone number, the app language's country first.
const CALLING: [string, string][] = [
  ["FI", "+358"],
  ["SE", "+46"],
  ["NO", "+47"],
  ["DK", "+45"],
  ["IS", "+354"],
  ["EE", "+372"],
  ["LV", "+371"],
  ["LT", "+370"],
];
const LANG_COUNTRY: Record<string, string> = { fi: "FI", sv: "SE", nb: "NO", nn: "NO", da: "DK", is: "IS", et: "EE", lv: "LV", lt: "LT" };

/** Owner sign-in: Apple (on iPhone), or a six-digit code by email or SMS. No password. */
export default function Login() {
  const { m, lang, f } = useT();
  const t = m.dashboard.login;
  const { signIn, signInWith } = useSession();
  const { setMode } = usePrefs();
  const router = useRouter();
  const [options, setOptions] = useState({ sms: false, google: false, apple: false });
  const [appleHere, setAppleHere] = useState(false);
  const [via, setVia] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(LANG_COUNTRY[lang] ?? "FI");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "code">("start");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const callingCode = CALLING.find(([c]) => c === country)?.[1] ?? "+358";
  const phone = number.trim().startsWith("+") ? number.replace(/[^\d+]/g, "") : callingCode + number.replace(/\D/g, "").replace(/^0+/, "");
  const to: SignInTo = via === "phone" ? { phone } : { email: email.trim() };

  useEffect(() => {
    ownerApi
      .signInOptions()
      .then(setOptions)
      .catch(() => undefined);
    if (Platform.OS === "ios")
      AppleAuthentication.isAvailableAsync()
        .then(setAppleHere)
        .catch(() => undefined);
  }, []);

  const explain = (e: unknown) =>
    e instanceof Offline ? m.app.common.offline : e instanceof ApiError && e.status === 429 ? t.tooMany : t.failed;

  const done = () => {
    setMode("hosting");
    registerForPush(true).catch(() => undefined);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/today");
  };

  const apple = async () => {
    setProblem(null);
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!credential.identityToken) return setProblem(t.socialFailed);
      setBusy(true);
      await signInWith("apple", credential.identityToken);
      done();
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return; // closed Apple's sheet
      const detail = e instanceof ApiError ? (e.body as { detail?: string } | undefined)?.detail : undefined;
      setProblem(detail === "no_owner" || detail === "no_email" ? t.noOwner : e instanceof Offline ? m.app.common.offline : t.socialFailed);
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (via === "email" && !EMAIL.test(email.trim())) return setProblem(m.book.errors.email);
    if (via === "phone" && !/^\+[1-9]\d{6,14}$/.test(phone)) return setProblem(t.phone);
    setBusy(true);
    setProblem(null);
    try {
      const r = await ownerApi.requestCode(to, lang);
      setDevCode(r.dev_code ?? null);
      setStep("code");
    } catch (e) {
      setProblem(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value.trim())) return;
    setBusy(true);
    setProblem(null);
    try {
      await signIn(to, value.trim());
      done();
    } catch (e) {
      setProblem(e instanceof ApiError && e.status === 400 ? t.wrongCode : explain(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={m.app.profile.ownerSignIn} onClose={() => (router.canGoBack() ? router.back() : router.replace("/explore"))} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Logo size={48} />
          <Text v="title">{t.title}</Text>

          {step === "start" ? (
            <>
              {options.apple && appleHere ? (
                <>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={radius.pill}
                    style={{ height: 50 }}
                    onPress={apple}
                  />
                  <View style={styles.or}>
                    <View style={styles.orLine} />
                    <Text v="small">{t.or}</Text>
                    <View style={styles.orLine} />
                  </View>
                </>
              ) : (
                <Text v="body" color={colors.soft}>
                  {t.lead}
                </Text>
              )}

              {options.sms ? (
                <View style={styles.tabs} accessibilityRole="tablist">
                  {(["email", "phone"] as const).map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => {
                        setVia(v);
                        setProblem(null);
                      }}
                      style={[styles.tab, via === v && styles.tabOn]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: via === v }}
                    >
                      <Text v="smallMedium" color={via === v ? colors.ink : colors.soft}>
                        {v === "email" ? t.byEmail : t.byPhone}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {via === "email" ? (
                <Field
                  label={t.email}
                  value={email}
                  onChangeText={setEmail}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                />
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: space.sm }}
                    accessibilityLabel={t.countryCode}
                  >
                    {CALLING.map(([c, dial]) => (
                      <Pressable
                        key={c}
                        onPress={() => setCountry(c)}
                        style={[styles.dial, country === c && styles.dialOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: country === c }}
                      >
                        <Text v="smallMedium" color={country === c ? "#fff" : colors.ink}>
                          {c} {dial}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Field
                    label={`${t.phone} (${callingCode})`}
                    value={number}
                    onChangeText={setNumber}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    keyboardType="phone-pad"
                    returnKeyType="send"
                    onSubmitEditing={sendCode}
                  />
                </>
              )}
              {problem ? <Problem text={problem} /> : null}
              <Button label={busy ? t.sending : t.send} busy={busy} onPress={sendCode} />
              <View style={{ marginTop: space.xl, gap: space.sm }}>
                <Text v="h3">{t.notOwner}</Text>
                <Button kind="secondary" label={t.join} onPress={() => openSite(`/${lang}/hosts`)} />
              </View>
            </>
          ) : (
            <>
              <Text v="body" color={colors.soft}>
                {via === "phone" ? f(t.sentToPhone, { phone }) : f(t.sentTo, { email: email.trim() })}
              </Text>
              <Field
                label={t.code}
                value={code}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6) void verify(digits);
                }}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoFocus
                maxLength={6}
                style={{ fontFamily: fonts.semibold, fontSize: 28, letterSpacing: 10, textAlign: "center" }}
              />
              {devCode ? <Text v="small">{f(t.devCode, { code: devCode })}</Text> : null}
              {problem ? <Problem text={problem} /> : null}
              <Button label={busy ? t.verifying : t.verify} busy={busy} disabled={code.length !== 6} onPress={() => verify()} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" }}>
                <Button
                  kind="ghost"
                  label={via === "phone" ? t.otherPhone : t.otherEmail}
                  onPress={() => {
                    setStep("start");
                    setCode("");
                    setProblem(null);
                  }}
                />
                <Button kind="ghost" label={t.resend} onPress={sendCode} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: "row", alignItems: "center", gap: space.md },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  tabs: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.ground },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  tabOn: { backgroundColor: "#fff", shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  dial: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  dialOn: { backgroundColor: colors.green, borderColor: colors.green },
});
