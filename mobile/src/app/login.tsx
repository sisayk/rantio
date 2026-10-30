import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { ApiError, Offline, ownerApi } from "@/api";
import { usePrefs } from "@/state/prefs";
import { registerForPush } from "@/state/push";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, fonts, space } from "@/theme";
import { Field } from "@/ui/form";
import { Button, Logo, Problem, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";
import { openSite } from "@/ui/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner sign-in: an emailed six-digit code, no password. */
export default function Login() {
  const { m, lang, f } = useT();
  const t = m.dashboard.login;
  const { signIn } = useSession();
  const { setMode } = usePrefs();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const explain = (e: unknown) =>
    e instanceof Offline ? m.app.common.offline : e instanceof ApiError && e.status === 429 ? t.tooMany : t.failed;

  const sendCode = async () => {
    if (!EMAIL.test(email.trim())) return setProblem(m.book.errors.email);
    setBusy(true);
    setProblem(null);
    try {
      const r = await ownerApi.requestCode(email.trim(), lang);
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
      await signIn(email.trim(), value.trim());
      setMode("hosting");
      registerForPush(true).catch(() => undefined);
      if (router.canDismiss()) router.dismissAll();
      router.replace("/today");
    } catch (e) {
      setProblem(e instanceof ApiError && e.status === 400 ? t.wrongCode : explain(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={m.app.profile.ownerSignIn} onClose={() => (router.canGoBack() ? router.back() : router.replace("/explore"))} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Logo size={48} />
          <Text v="title">{t.title}</Text>
          <Text v="body" color={colors.soft}>
            {step === "email" ? t.lead : f(t.sentTo, { email: email.trim() })}
          </Text>

          {step === "email" ? (
            <>
              <Field
                label={t.email}
                value={email}
                onChangeText={setEmail}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={sendCode}
              />
              {problem ? <Problem text={problem} /> : null}
              <Button label={busy ? t.sending : t.send} busy={busy} onPress={sendCode} />
              <View style={{ marginTop: space.xl, gap: space.sm }}>
                <Text v="h3">{t.notOwner}</Text>
                <Button kind="secondary" label={t.join} onPress={() => openSite(`/${lang}/hosts`)} />
              </View>
            </>
          ) : (
            <>
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
                  label={t.otherEmail}
                  onPress={() => {
                    setStep("email");
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
