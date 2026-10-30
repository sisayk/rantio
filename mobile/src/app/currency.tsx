import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CURRENCIES, currencySign } from "@/lib/currency";
import { usePrefs } from "@/state/prefs";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Icon, tap, Text } from "@/ui/kit";
import { SheetBar } from "@/ui/screen";

export default function CurrencySheet() {
  const { m, lang, currencyName } = useT();
  const { currency, setCurrency } = usePrefs();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={m.guest.currency.title} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        {CURRENCIES.map((c) => {
          const on = c === currency;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                setCurrency(c);
                router.back();
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <Text v="bodyMedium">{currencyName(c)}</Text>
                <Text v="small">
                  {c} · {currencySign(lang, c)}
                </Text>
              </View>
              {on ? <Icon name="checkmark" color={colors.green} /> : null}
            </Pressable>
          );
        })}
        <Text v="small" style={{ marginTop: space.lg }}>
          {m.guest.currency.note}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
