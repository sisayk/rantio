// Who a message to an owner comes from. Signed in (an owner travelling), or having written
// before from this phone, the guest isn't asked for their name and email again: they see
// "Sending as …" with a Change button that opens the fields.
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Avatar, Button, Text } from "@/ui/kit";

export function useSender() {
  const { owner } = useSession();
  const { guest, setGuest } = usePrefs();
  const known = owner?.email ? { name: owner.name, email: owner.email } : guest;
  // null while the known name and email are used; the typed ones once the guest changes them.
  const [typed, setTyped] = useState<{ name: string; email: string } | null>(null);
  const name = typed ? typed.name : (known?.name ?? "");
  const email = typed ? typed.email : (known?.email ?? "");
  return {
    name,
    email,
    /** Show the "Sending as" card instead of the two fields. */
    usingKnown: !typed && !!known?.name && !!known?.email,
    setName: (v: string) => setTyped({ name: v, email }),
    setEmail: (v: string) => setTyped({ name, email: v }),
    change: () => setTyped({ name, email }),
    /** After sending: a guest who isn't signed in is remembered on this phone. */
    remember: () => {
      if (!owner) setGuest({ name: name.trim(), email: email.trim() });
    },
  };
}

export function SenderCard({ name, email, hint, onChange }: { name: string; email: string; hint?: string; onChange: () => void }) {
  const { m } = useT();
  const c = m.guest.contact;
  return (
    <View style={{ gap: 6 }}>
      <Text v="smallMedium">{c.sendingAs}</Text>
      <View style={styles.card}>
        <Avatar name={name || email} size={40} />
        <View style={{ flex: 1 }}>
          <Text v="bodyMedium" numberOfLines={1}>
            {name || email}
          </Text>
          {name ? (
            <Text v="small" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
        <Button small kind="ghost" label={c.change} onPress={onChange} />
      </View>
      {hint ? <Text v="tiny">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
});
