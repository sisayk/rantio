import { useRouter } from "expo-router";
import { View } from "react-native";

import { ACCOUNT } from "@/i18n/messages/account";
import { useHost } from "@/state/host";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { space } from "@/theme";
import { IconButton } from "@/ui/kit";
import { MenuDivider, MenuRow, ProfileCard } from "@/ui/menu";
import { SwitchPill, TabScreen } from "@/ui/screen";
import { MoreRows, openSite } from "@/ui/settings";

/** The host's Menu, laid out like Profile: the profile card, hosting, Account settings, help and legal. */
export default function Menu() {
  const { m, lang } = useT();
  const s = ACCOUNT[lang].settings;
  const { owner, signOut } = useSession();
  const { summary } = useHost();
  const { setMode } = usePrefs();
  const router = useRouter();
  const missing = owner?.details?.missing ?? [];

  const toTravelling = () => {
    setMode("travelling");
    router.replace("/explore");
  };

  return (
    <View style={{ flex: 1 }}>
      <TabScreen
        title={m.app.tabs.menu}
        right={<IconButton name="notifications-outline" label={m.app.menu.notifications} onPress={() => router.push("/inbox")} />}
        contentStyle={{ paddingBottom: 140 }}
      >
        {owner ? <ProfileCard owner={owner} onPress={() => router.push("/account/personal")} /> : null}

        <View style={{ marginTop: space.lg }}>
          <MenuRow icon="settings-outline" label={s.title} badge={missing.length ? s.needed : undefined} onPress={() => router.push("/account")} />
          <MenuDivider />
          <MenuRow icon="grid-outline" label={m.listings.title} detail={summary?.cottages.length ? summary.cottages.map((c) => c.name).join(", ") : m.listings.add} onPress={() => router.push("/listings")} />
          <MenuRow icon="list-outline" label={m.app.menu.bookings} onPress={() => router.push("/bookings")} />
          <MenuRow icon="hardware-chip-outline" label={m.owner.monitor.title.split(":")[0]} badge={m.owner.monitor.badge} badgeTone="quiet" onPress={() => router.push("/monitor")} />
          <MenuRow icon="desktop-outline" label={m.app.menu.web} onPress={() => openSite(`/${lang}/hosting`)} />
          <MenuDivider />
          <MoreRows
            onLogout={async () => {
              setMode("travelling");
              await signOut();
              router.replace("/explore");
            }}
          />
        </View>
      </TabScreen>
      <SwitchPill label={m.dashboard.switchToTraveling} onPress={toTravelling} />
    </View>
  );
}
