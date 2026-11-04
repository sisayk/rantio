import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ApiError, Offline, ownerApi, type SignInTo } from "@/api";
import { usePrefs } from "@/state/prefs";
import { registerForPush } from "@/state/push";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, fonts, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { Button, Logo, Problem, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";

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

// Google sign-in's public client IDs (Google Cloud project "rantio"). With the website's
// ID as the server client, the ID token is made for the same audience the website uses.
const GOOGLE_IOS_CLIENT = "42238401416-vs5r0jc5usqt7h5r8ifb5dnnqrcg9enl.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT = "42238401416-d9tgb4953a1tova813mof3mgprosvt6l.apps.googleusercontent.com";
// Android needs its own client (the app's signing fingerprint) first; until then iPhone only.
const GOOGLE_HERE = Platform.OS === "ios";
if (GOOGLE_HERE) GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT, webClientId: GOOGLE_WEB_CLIENT });

/** Owner sign-in: Apple (on iPhone), Google, or a six-digit code by email or SMS. No password. */
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

  // Hosts go to their hosting tabs; anyone else signed in stays on the travelling side.
  const done = (me: { is_host: boolean } | null) => {
    if (router.canDismiss()) router.dismissAll();
    if (me && !me.is_host) {
      router.replace("/profile");
      return;
    }
    setMode("hosting");
    registerForPush(true).catch(() => undefined);
    router.replace("/today");
  };

  const apple = async () => {
    setProblem(null);
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!credential.identityToken) return setProblem(t.socialFailed);
      setBusy(true);
      done(await signInWith("apple", credential.identityToken));
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return; // closed Apple's sheet
      const detail = e instanceof ApiError ? (e.body as { detail?: string } | undefined)?.detail : undefined;
      setProblem(detail === "no_owner" || detail === "no_email" ? t.noOwner : e instanceof Offline ? m.app.common.offline : t.socialFailed);
      setBusy(false);
    }
  };

  const google = async () => {
    setProblem(null);
    try {
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return; // closed Google's sheet
      if (!res.data.idToken) return setProblem(t.socialFailed);
      setBusy(true);
      done(await signInWith("google", res.data.idToken));
    } catch (e) {
      if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return;
      const detail = e instanceof ApiError ? (e.body as { detail?: string } | undefined)?.detail : undefined;
      setProblem(detail === "no_owner" || detail === "no_email" ? t.noOwner : e instanceof Offline ? m.app.common.offline : t.socialFailed);
      setBusy(false);
    } finally {
      GoogleSignin.signOut().catch(() => undefined); // let the next sign-in choose an account again
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
      done(await signIn(to, value.trim()));
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
              {(options.apple && appleHere) || (options.google && GOOGLE_HERE) ? (
                <>
                  {options.apple && appleHere ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={radius.pill}
                      style={{ height: 50 }}
                      onPress={apple}
                    />
                  ) : null}
                  {options.google && GOOGLE_HERE ? (
                    <Pressable
                      onPress={google}
                      disabled={busy}
                      style={({ pressed }) => [styles.google, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t.google}
                    >
                      <GoogleG />
                      <Text v="bodyMedium">{t.google}</Text>
                    </Pressable>
                  ) : null}
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
                <Button kind="secondary" label={t.join} onPress={() => router.push("/list-cottage")} />
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

/** Google's four-colour "G", as its sign-in button guidelines show it. */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: "row", alignItems: "center", gap: space.md },
  google: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#dadce0",
    backgroundColor: "#fff",
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  tabs: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.ground },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  tabOn: { backgroundColor: "#fff", shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  dial: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  dialOn: { backgroundColor: colors.green, borderColor: colors.green },
});
