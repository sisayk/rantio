import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, radius, shadowFloat, space } from "@/theme";
import { Avatar, Button, Icon, Logo, Text, Wordmark } from "@/ui/kit";
import { SwitchPill, TabScreen } from "@/ui/screen";
import { AboutRows, openSite, SettingsRows } from "@/ui/settings";

export default function Profile() {
  const { m, lang } = useT();
  const { setMode } = usePrefs();
  const { signedIn, owner } = useSession();
  const router = useRouter();

  const toHosting = () => {
    if (!signedIn) return router.push("/login");
    setMode("hosting");
    router.replace("/today");
  };

  return (
    <View style={{ flex: 1 }}>
      <TabScreen title={m.app.tabs.profile} contentStyle={{ paddingBottom: 140 }}>
        <View style={[styles.card, shadowFloat]}>
          {signedIn ? (
            <>
              <Avatar name={owner?.name ?? ""} size={96} />
              <Text v="title" style={{ textAlign: "center" }}>
                {owner?.name ?? ""}
              </Text>
              <Text v="small">{owner?.email ?? ""}</Text>
            </>
          ) : (
            <>
              <Logo size={64} />
              <Wordmark height={34} />
              <Text v="small" style={{ textAlign: "center" }}>
                {m.guest.hero.lead}
              </Text>
              <Button kind="secondary" label={m.app.profile.ownerSignIn} onPress={() => router.push("/login")} style={{ marginTop: space.sm }} />
            </>
          )}
        </View>

        <Pressable onPress={() => openSite(`/${lang}/hosts`)} style={({ pressed }) => [styles.hostCard, shadowFloat, pressed && { opacity: 0.85 }]} accessibilityRole="link">
          <Text style={{ fontSize: 44, lineHeight: 52 }}>🏡</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text v="h3">{m.guest.becomeHost}</Text>
            <Text v="small">{m.app.profile.listLead}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <SettingsRows />
        <AboutRows />
      </TabScreen>
      <SwitchPill label={m.app.profile.switchToHosting} onPress={toHosting} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: space.xs,
    padding: space.xl,
    paddingVertical: space.xxl,
    borderRadius: 28,
    backgroundColor: colors.page,
  },
  hostCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.page,
    marginTop: space.lg,
  },
});
