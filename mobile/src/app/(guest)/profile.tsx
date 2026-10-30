import { useRouter } from "expo-router";
import { View } from "react-native";

import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Avatar, Button, Card, Logo, Row, Section, Text } from "@/ui/kit";
import { TabScreen } from "@/ui/screen";
import { AboutRows, openSite, SettingsRows } from "@/ui/settings";

export default function Profile() {
  const { m, lang, f } = useT();
  const { setMode } = usePrefs();
  const { signedIn, owner } = useSession();
  const router = useRouter();

  const toHosting = () => {
    if (!signedIn) return router.push("/login");
    setMode("hosting");
    router.replace("/today");
  };

  return (
    <TabScreen title={m.app.tabs.profile}>
      {signedIn ? (
        <Card style={{ gap: space.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Avatar name={owner?.name ?? ""} size={56} />
            <View style={{ flex: 1 }}>
              <Text v="h2">{owner?.name ?? ""}</Text>
              <Text v="small">{owner ? f(m.guest.menu.signedInAs, { name: owner.email }) : ""}</Text>
            </View>
          </View>
          <Button label={m.app.profile.switchToHosting} icon="swap-horizontal" onPress={toHosting} />
        </Card>
      ) : (
        <Card style={{ gap: space.md, backgroundColor: colors.greenTint, borderColor: colors.greenTint }}>
          <Logo size={40} />
          <Text v="h2">{m.guest.hostBand.title}</Text>
          <Text v="body" color={colors.soft}>
            {m.app.profile.listLead}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs }}>
            <Button label={m.app.profile.listCottage} onPress={() => openSite(`/${lang}/hosts`)} />
            <Button kind="secondary" label={m.app.profile.ownerSignIn} onPress={() => router.push("/login")} />
          </View>
        </Card>
      )}

      {signedIn ? (
        <Section title={m.app.profile.hosting}>
          <Row icon="home-outline" label={m.app.profile.switchToHosting} onPress={toHosting} last />
        </Section>
      ) : null}

      <SettingsRows />
      <AboutRows />
    </TabScreen>
  );
}
