import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ownerApi } from "@/api";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { LANG_INFO, LANGS, useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Icon, tap, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";

export default function LanguageSheet() {
  const { m, lang, language } = useT();
  const { setLang } = usePrefs();
  const { signedIn } = useSession();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* The bar is the scroll view's sticky first child: in an iOS form sheet the scroll view is laid
          out from the sheet's top edge, so a bar above it ended up under the first row. */}
      <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: space.xxl }}>
        <SheetBar title={m.common.language.title} onClose={() => router.back()} />
        <View style={{ paddingHorizontal: space.xl }}>
          {LANGS.map((l) => {
            const on = l === lang;
            return (
              <Pressable
                key={l}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  tap();
                  setLang(l);
                  // The owner's emails follow the app's language too.
                  if (signedIn) ownerApi.setLanguage(l).catch(() => undefined);
                  router.back();
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text v="bodyMedium">{LANG_INFO[l].native}</Text>
                  {l !== lang ? <Text v="small">{language(l)}</Text> : null}
                </View>
                {on ? <Icon name="checkmark" color={colors.green} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
