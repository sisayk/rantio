// "What this place offers": each feature with its own line icon (lib/amenityIcons.ts), as on Airbnb.
import { StyleSheet, View } from "react-native";

import type { FeatureKey } from "@/lib/catalog";
import { colors, space } from "@/theme";
import { AmenityIcon } from "@/ui/amenity-icon";
import { Text } from "@/ui/kit";

/** Worth telling a guest when a cottage doesn't have them (shown struck through). */
export const NOT_INCLUDED: FeatureKey[] = ["internet", "shower", "indoorWc", "dishwasher", "washingMachine", "tv"];

export function AmenityRow({ feature, label, missing, last }: { feature: FeatureKey; label: string; missing?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.line]}>
      <AmenityIcon amenity={feature} size={26} color={missing ? colors.faint : colors.green} />
      <Text v="body" color={missing ? colors.soft : colors.ink} style={missing ? { textDecorationLine: "line-through" } : undefined}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
