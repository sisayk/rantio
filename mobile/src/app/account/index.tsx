import { useRouter } from "expo-router";
import { View } from "react-native";

import { ACCOUNT } from "@/i18n/messages/account";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { SECTION_OF, type SettingsSection, withDefaults } from "@/ui/accountForm";
import { Card, Text } from "@/ui/kit";
import { MenuDivider, MenuRow, SettingsPage } from "@/ui/menu";

/** Account settings: one row per page, like Airbnb's. Hosts also get business details and taxes. */
export default function AccountSettings() {
  const { m, lang, native } = useT();
  const s = ACCOUNT[lang].settings;
  const h = ACCOUNT[lang].host;
  const prefs = usePrefs();
  const { owner } = useSession();
  const router = useRouter();
  const det = withDefaults(owner?.details);
  const host = !!owner?.is_host;
  const missing = host ? (det?.missing ?? []) : [];
  const needs = (section: SettingsSection) => (missing.some((k) => SECTION_OF[k] === section) ? s.needed : undefined);
  const open = (section: SettingsSection) => router.push(`/account/${section}`);

  return (
    <SettingsPage title={s.title}>
      {missing.length ? (
        <Card style={{ gap: space.xs, backgroundColor: colors.berryTint, marginBottom: space.md }}>
          <Text v="h3">{h.readyTitle}</Text>
          <Text v="small">{h.readyLead}</Text>
          <Text v="smallMedium" style={{ marginTop: space.xs }}>
            {h.stillNeeded} {missing.map((k) => h.missing[k]).join(", ")}
          </Text>
        </Card>
      ) : null}

      {owner ? (
        <>
          <MenuRow icon="person-outline" label={s.personal} badge={needs("personal")} onPress={() => open("personal")} />
          <MenuRow icon="shield-outline" label={s.security} onPress={() => open("security")} />
          <MenuRow icon="notifications-outline" label={s.notifications} onPress={() => open("notifications")} />
          {host ? <MenuRow icon="cash-outline" label={s.payments} badge={needs("payments")} onPress={() => open("payments")} /> : null}
        </>
      ) : null}
      <MenuRow icon="globe-outline" label={m.app.profile.language} value={native(lang)} onPress={() => router.push("/language")} />
      <MenuRow icon="pricetag-outline" label={m.app.profile.currency} value={prefs.currency} onPress={() => router.push("/currency")} />

      {host ? (
        <>
          <MenuDivider />
          <MenuRow icon="briefcase-outline" label={s.business} badge={needs("business")} onPress={() => open("business")} />
          <MenuRow icon="calculator-outline" label={s.taxes} badge={needs("taxes")} onPress={() => open("taxes")} />
        </>
      ) : null}
      <View style={{ height: space.xl }} />
    </SettingsPage>
  );
}
