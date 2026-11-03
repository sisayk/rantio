// Where a cottage is listed: the booking sites' own icons, as on the website.
// Being on Airbnb, Booking.com, Vrbo, Expedia and the rest is what Rantio does for owners,
// so every cottage card shows it.
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { API_URL } from "@/api";
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import { colors } from "@/theme";
import { Text } from "@/ui/kit";

/** Overlapping round site icons with "+n" for the rest, e.g. on a photo. */
export function ChannelStack({ channels, max = 4, size = 22, onPhoto = true }: { channels: ChannelId[]; max?: number; size?: number; onPhoto?: boolean }) {
  const shown = channels.slice(0, max);
  const rest = channels.length - shown.length;
  return (
    <View
      style={[styles.pill, onPhoto && styles.onPhoto]}
      accessible
      accessibilityLabel={channels.map((c) => CHANNELS[c].name).join(", ")}
    >
      {shown.map((c, i) => (
        <View key={c} style={[styles.ring, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, marginLeft: i ? -size * 0.32 : 0, zIndex: max - i }]}>
          <Image source={{ uri: channelIcon(c, API_URL) }} style={{ width: size - 4, height: size - 4, borderRadius: 4 }} recyclingKey={c} />
        </View>
      ))}
      {rest > 0 ? (
        <Text v="tiny" color={colors.ink} style={{ marginLeft: 4, marginRight: 2 }}>
          +{rest}
        </Text>
      ) : null}
    </View>
  );
}

/** A big tile for one site, used where the guest picks where to book. */
export function ChannelTile({ channel, size = 28 }: { channel: ChannelId; size?: number }) {
  return (
    <View style={styles.tileIcon}>
      <Image source={{ uri: channelIcon(channel, API_URL) }} style={{ width: size, height: size, borderRadius: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  onPhoto: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 999, paddingVertical: 3, paddingLeft: 3, paddingRight: 8 },
  ring: { backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tileIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.ground, alignItems: "center", justifyContent: "center" },
});
