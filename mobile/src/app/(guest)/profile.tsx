import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ACCOUNT } from "@/i18n/messages/account";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, radius, shadowFloat, space } from "@/theme";
import { SECTION_OF } from "@/ui/accountForm";
import { Button, IconButton, Logo, Text, Wordmark } from "@/ui/kit";
import { MenuDivider, MenuRow, ProfileCard } from "@/ui/menu";
import { SwitchPill, TabScreen } from "@/ui/screen";
import { MoreRows } from "@/ui/settings";

/** Profile, like Airbnb's: the profile card, becoming a host, then Account settings, help and legal. */
export default function Profile() {
  const { m, lang, native } = useT();
  const s = ACCOUNT[lang].settings;
  const prefs = usePrefs();
  const { signedIn, owner, signOut } = useSession();
  const router = useRouter();
  const missing = owner?.is_host ? (owner.details?.missing ?? []).filter((k) => k in SECTION_OF) : [];

  const toHosting = () => {
    if (!signedIn) return router.push("/login");
    if (owner && !owner.is_host) return router.push("/list-cottage");
    prefs.setMode("hosting");
    router.replace("/today");
  };

  return (
    <View style={{ flex: 1 }}>
      <TabScreen
        title={m.app.tabs.profile}
        right={signedIn ? <IconButton name="notifications-outline" label={m.app.menu.notifications} onPress={() => router.push("/messages")} /> : undefined}
        contentStyle={{ paddingBottom: 140 }}
      >
        {signedIn && owner ? (
          <ProfileCard owner={owner} onPress={() => router.push("/account/personal")} />
        ) : (
          <View style={[styles.card, shadowFloat]}>
            <Logo size={64} />
            <Wordmark height={34} />
            <Text v="small" style={{ textAlign: "center" }}>
              {m.guest.hero.lead}
            </Text>
            <Button label={m.app.profile.ownerSignIn} onPress={() => router.push("/login")} style={{ marginTop: space.sm, alignSelf: "stretch" }} />
          </View>
        )}

        {!owner?.is_host ? (
          <Pressable onPress={() => router.push("/list-cottage")} style={({ pressed }) => [styles.hostCard, shadowFloat, pressed && { opacity: 0.85 }]} accessibilityRole="link">
            <Text style={{ fontSize: 48, lineHeight: 56 }}>🏡</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text v="h3" style={{ fontSize: 18 }}>
                {m.guest.becomeHost}
              </Text>
              <Text v="small">{m.app.profile.listLead}</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          {signedIn ? (
            <MenuRow icon="settings-outline" label={s.title} badge={missing.length ? s.needed : undefined} onPress={() => router.push("/account")} />
          ) : (
            <>
              <MenuRow icon="globe-outline" label={m.app.profile.language} value={native(lang)} onPress={() => router.push("/language")} />
              <MenuRow icon="pricetag-outline" label={m.app.profile.currency} value={prefs.currency} onPress={() => router.push("/currency")} />
            </>
          )}
          {signedIn && owner?.is_host ? <MenuRow icon="home-outline" label={m.listings.title} onPress={() => router.push("/listings")} /> : null}
          <MoreRows onLogout={signedIn ? () => void signOut() : undefined} />
          {!signedIn ? <MenuDivider /> : null}
        </View>
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
    borderRadius: radius.lg + 8,
    backgroundColor: colors.page,
  },
  hostCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg + 8,
    backgroundColor: colors.page,
    marginTop: space.lg,
  },
});
