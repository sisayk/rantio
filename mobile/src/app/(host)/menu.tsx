import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Switch, View } from "react-native";

import { useHost } from "@/state/host";
import { usePrefs } from "@/state/prefs";
import { pushState, type PushState, registerForPush } from "@/state/push";
import { useSession } from "@/state/session";
import { DeleteAccountButton } from "@/ui/account";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Avatar, Button, Card, Row, Section, Text } from "@/ui/kit";
import { SwitchPill, TabScreen } from "@/ui/screen";
import { AboutRows, openSite, SettingsRows } from "@/ui/settings";

export default function Menu() {
  const { m, lang } = useT();
  const { owner, signOut } = useSession();
  const { summary } = useHost();
  const { setMode } = usePrefs();
  const router = useRouter();
  const [push, setPush] = useState<PushState | null>(null);

  useFocusEffect(
    useCallback(() => {
      pushState()
        .then(setPush)
        .catch(() => setPush("unavailable"));
    }, []),
  );

  const toTravelling = () => {
    setMode("travelling");
    router.replace("/explore");
  };

  return (
    <View style={{ flex: 1 }}>
      <TabScreen title={m.app.tabs.menu} contentStyle={{ paddingBottom: 140 }}>
        <Card style={{ gap: space.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Avatar name={owner?.name ?? summary?.owner.name ?? ""} size={56} />
            <View style={{ flex: 1 }}>
              <Text v="h2">{owner?.name ?? summary?.owner.name ?? ""}</Text>
              <Text v="small">{owner?.email ?? summary?.owner.email ?? ""}</Text>
            </View>
          </View>
        </Card>

        <Section title={m.app.profile.hosting}>
          <Row icon="grid-outline" label={m.listings.title} detail={m.listings.add} onPress={() => router.push("/listings")} />
          {summary?.cottages.map((c) => (
            <Row
              key={c.id}
              icon="home-outline"
              label={c.name}
              detail={`${m.listings.nav.photos} · ${m.listings.nav.pricing}`}
              onPress={() => router.push(`/listing/${c.id}`)}
            />
          ))}
          <Row icon="list-outline" label={m.app.menu.bookings} onPress={() => router.push("/bookings")} />
          <Row icon="hardware-chip-outline" label={m.owner.monitor.title.split(":")[0]} detail={m.owner.monitor.badge} onPress={() => router.push("/monitor")} />
          <Row icon="globe-outline" label={m.app.menu.web} onPress={() => openSite(`/${lang}/hosting`)} last />
        </Section>

        {push && push !== "unavailable" ? (
          <Section title={m.app.menu.notifications}>
            <Row
              icon="notifications-outline"
              label={m.app.menu.notifications}
              detail={push === "blocked" ? m.app.menu.notificationsBlocked : m.app.menu.notificationsLead}
              right={
                push === "blocked" ? (
                  <Button small kind="secondary" label={m.app.menu.openSettings} onPress={() => Linking.openSettings()} />
                ) : (
                  <Switch
                    value={push === "on"}
                    disabled={push === "on"}
                    onValueChange={async (on) => {
                      if (on) setPush(await registerForPush(true).catch(() => "off" as const));
                    }}
                    trackColor={{ true: colors.green, false: colors.line }}
                    thumbColor="#ffffff"
                  />
                )
              }
              last
            />
          </Section>
        ) : null}

        <SettingsRows currency={false} />
        <AboutRows />

        <View style={{ marginTop: space.xl }}>
          <Button
            kind="danger"
            icon="log-out-outline"
            label={m.dashboard.logout}
            onPress={async () => {
              setMode("travelling");
              await signOut();
              router.replace("/explore");
            }}
          />
          <DeleteAccountButton
            onDeleted={() => {
              setMode("travelling");
              router.replace("/explore");
            }}
          />
        </View>
      </TabScreen>
      <SwitchPill label={m.dashboard.switchToTraveling} onPress={toTravelling} />
    </View>
  );
}
