import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";

import { ApiError, ownerApi } from "@/api";
import { MONITOR } from "@/i18n/messages/monitor";
import { useHost } from "@/state/host";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Chip } from "@/ui/controls";
import { Field } from "@/ui/form";
import { Button, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";

/** Connecting a box: the serial and code from its sticker, and which cottage it's in. */
export default function ConnectMonitor() {
  const { lang } = useT();
  const t = MONITOR[lang];
  const router = useRouter();
  const { summary } = useHost();
  const cottages = summary?.cottages ?? [];
  const [serial, setSerial] = useState("");
  const [code, setCode] = useState("");
  const [cottage, setCottage] = useState<number | null>(cottages.length === 1 ? cottages[0].id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await ownerApi.claimMonitor(serial, code, cottage);
      router.replace(`/monitor/${d.id}`);
    } catch (e) {
      const key = e instanceof ApiError ? String(e.body.error ?? "") : "";
      setError(t.errors[key as keyof typeof t.errors] ?? t.errors.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={t.connectTitle} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Text v="small">{t.connectLead}</Text>
          <Field label={t.serial} value={serial} onChangeText={(v) => setSerial(v.toUpperCase())} placeholder="MM-7Q4K2X" autoCapitalize="characters" autoCorrect={false} maxLength={12} />
          <Field label={t.code} value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="ABCD-2345" autoCapitalize="characters" autoCorrect={false} maxLength={9} />
          {cottages.length ? (
            <View style={{ gap: space.sm }}>
              <Text v="smallMedium">{t.cottage}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {cottages.map((c) => (
                  <Chip key={c.id} label={c.name} on={cottage === c.id} onPress={() => setCottage(c.id)} />
                ))}
              </View>
            </View>
          ) : null}
          {error ? (
            <Text v="small" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button label={t.connectButton} busy={busy} disabled={serial.trim().length < 6 || code.trim().length < 8} onPress={connect} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
