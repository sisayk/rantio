// "What this place offers": each feature with its own line icon, as on Airbnb.
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import type { FeatureKey } from "@/lib/catalog";
import { colors, space } from "@/theme";
import { Text } from "@/ui/kit";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export const AMENITY_ICON: Record<FeatureKey, IconName> = {
  instantBook: "flash",
  freeCancellation: "calendar-check-outline",
  lake: "waves",
  sea: "waves",
  river: "waves",
  pond: "waves",
  privateShore: "beach",
  sharedShore: "beach",
  shoreAccess: "walk",
  waterAccess: "swim",
  dishwasher: "dishwasher",
  fridge: "fridge-outline",
  cooking: "pot-steam-outline",
  microwave: "microwave",
  freezer: "snowflake",
  stove: "stove",
  oven: "toaster-oven",
  coffeeMaker: "coffee-maker-outline",
  grillHut: "grill-outline",
  electricSauna: "flash-outline",
  smokeSauna: "smoke",
  woodSauna: "fire",
  nearSki: "ski",
  internet: "wifi",
  dryingCabinet: "hanger",
  tumbleDryer: "tumble-dryer",
  jetty: "pier",
  loft: "stairs",
  hotTub: "hot-tub",
  jacuzzi: "hot-tub",
  washingMachine: "washing-machine",
  highChair: "baby-face-outline",
  shower: "shower-head",
  evCharging: "ev-station",
  fireplace: "fireplace",
  tv: "television",
  pool: "pool",
  outdoorJacuzzi: "hot-tub",
  babyBed: "bed-outline",
  noElectricity: "power-plug-off-outline",
  solarPower: "solar-power",
  carriedWater: "bucket-outline",
  heatPump: "heat-pump-outline",
  indoorWc: "toilet",
  outdoorWc: "toilet",
  boat: "rowing",
  canoe: "kayaking",
  pets: "paw",
  wheelchair: "wheelchair-accessibility",
};

/** Worth telling a guest when a cottage doesn't have them (shown struck through). */
export const NOT_INCLUDED: FeatureKey[] = ["internet", "shower", "indoorWc", "dishwasher", "washingMachine", "tv"];

export function AmenityRow({ feature, label, missing, last }: { feature: FeatureKey; label: string; missing?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.line]}>
      <MaterialCommunityIcons name={AMENITY_ICON[feature] ?? "check"} size={26} color={missing ? colors.faint : colors.ink} />
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
