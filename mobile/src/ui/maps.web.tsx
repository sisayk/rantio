// The web preview (used in development) has no native map: a plain placeholder instead.
import { StyleSheet, View, type ViewStyle } from "react-native";

import type { Listing } from "@/lib/listings";
import { colors } from "@/theme";
import { Icon } from "@/ui/kit";

export function CottagesMap({ style }: { listings: Listing[]; selected: string | null; onSelect: (id: string | null) => void; style?: ViewStyle; bottomPadding?: number; topPadding?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.box, style]}>
      <Icon name="map-outline" size={48} color={colors.faint} />
    </View>
  );
}

export function PinMap({ style }: { lat: number; lng: number; style?: ViewStyle }) {
  return (
    <View style={[styles.box, style]}>
      <Icon name="location" size={32} color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" } });
