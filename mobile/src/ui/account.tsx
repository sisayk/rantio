// Deleting the account, from Profile and Menu (Apple requires it in the app).
import { useState } from "react";
import { Alert } from "react-native";

import { ACCOUNT } from "@/i18n/messages/account";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { space } from "@/theme";
import { Button } from "@/ui/kit";

export function DeleteAccountButton({ onDeleted }: { onDeleted?: () => void }) {
  const { lang, m } = useT();
  const t = ACCOUNT[lang];
  const { deleteAccount } = useSession();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      Alert.alert(t.done);
      onDeleted?.();
    } catch {
      Alert.alert(t.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      small
      kind="ghost"
      icon="trash-outline"
      label={t.delete}
      busy={busy}
      onPress={() =>
        Alert.alert(t.title, t.body, [
          { text: m.app.common.cancel, style: "cancel" },
          { text: t.delete, style: "destructive", onPress: () => void run() },
        ])
      }
      style={{ alignSelf: "center", marginTop: space.sm }}
    />
  );
}
