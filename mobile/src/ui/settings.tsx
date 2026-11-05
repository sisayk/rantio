// Settings rows both modes show: language, currency, legal pages and contact.
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Linking, View } from "react-native";

import { SITE_URL } from "@/api";
import { CONTACT_EMAIL } from "@/lib/content";
import { usePrefs } from "@/state/prefs";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { ACCOUNT } from "@/i18n/messages/account";
import { Row, Section, Text } from "@/ui/kit";
import { MenuDivider, MenuRow } from "@/ui/menu";

export const openSite = (path: string) =>
  WebBrowser.openBrowserAsync(`${SITE_URL}${path}`, { controlsColor: colors.green, toolbarColor: "#ffffff" }).catch(() => undefined);

export function SettingsRows({ currency = true }: { currency?: boolean }) {
  const { m, lang, native, currencyName } = useT();
  const prefs = usePrefs();
  const router = useRouter();
  return (
    <Section title={m.app.profile.settings}>
      <Row icon="language-outline" label={m.app.profile.language} value={native(lang)} onPress={() => router.push("/language")} last={!currency} />
      {currency ? (
        <Row icon="cash-outline" label={m.app.profile.currency} value={`${prefs.currency} · ${currencyName(prefs.currency)}`} onPress={() => router.push("/currency")} last />
      ) : null}
    </Section>
  );
}

export function AboutRows() {
  const { m, lang, f } = useT();
  return (
    <>
      <Section title={m.app.profile.legal}>
        <Row icon="shield-checkmark-outline" label={m.app.profile.privacy} onPress={() => openSite(`/${lang}/privacy`)} />
        <Row icon="document-text-outline" label={m.app.profile.terms} onPress={() => openSite(`/${lang}/terms`)} />
        <Row icon="mail-outline" label={m.app.profile.contact} value={CONTACT_EMAIL} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} last />
      </Section>
      <View style={{ marginTop: space.xl, gap: 2 }}>
        <Text v="tiny">{m.common.footer.note}</Text>
        <Text v="tiny">{f(m.app.profile.version, { version: `${Application.nativeApplicationVersion ?? "1.0.0"} (${Application.nativeBuildVersion ?? "1"})` })}</Text>
      </View>
    </>
  );
}

/** The bottom of Profile and Menu: help, privacy and legal, log out, and the version. */
export function MoreRows({ onLogout }: { onLogout?: () => void }) {
  const { m, lang, f } = useT();
  const s = ACCOUNT[lang].settings;
  return (
    <>
      <MenuRow icon="help-circle-outline" label={s.help} detail={CONTACT_EMAIL} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} />
      <MenuRow icon="hand-left-outline" label={m.app.profile.privacy} onPress={() => openSite(`/${lang}/privacy`)} />
      <MenuDivider />
      <MenuRow icon="document-text-outline" label={s.legal} onPress={() => openSite(`/${lang}/terms`)} />
      {onLogout ? <MenuRow icon="log-out-outline" label={s.logout} onPress={onLogout} /> : null}
      <View style={{ marginTop: space.xl, gap: 2 }}>
        <Text v="tiny">{m.common.footer.note}</Text>
        <Text v="tiny">{f(m.app.profile.version, { version: `${Application.nativeApplicationVersion ?? "1.0.0"} (${Application.nativeBuildVersion ?? "1"})` })}</Text>
      </View>
    </>
  );
}
