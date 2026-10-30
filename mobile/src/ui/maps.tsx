// Maps: Apple Maps on iPhone, Google Maps on Android (react-native-maps).
// Cottages show as price pins, as on Airbnb's map.
import { type ComponentRef, useEffect, useRef } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { type Listing, listingCurrency } from "@/lib/listings";
import { useMoney } from "@/state/money";
import { colors, fonts } from "@/theme";
import { Logo, Text } from "@/ui/kit";

/** Finland to Iceland and the Baltics. */
const NORTH = { latitude: 62, longitude: 15, latitudeDelta: 22, longitudeDelta: 40 };

export function CottagesMap({
  listings,
  selected,
  onSelect,
  style,
  bottomPadding = 0,
  topPadding = 0,
}: {
  listings: Listing[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  style?: ViewStyle;
  bottomPadding?: number;
  topPadding?: number;
}) {
  const ref = useRef<ComponentRef<typeof MapView>>(null);
  const money = useMoney();
  const ids = listings.map((l) => l.id).join(",");

  // Show all the cottages in view whenever the set changes (a category, a search).
  useEffect(() => {
    if (!listings.length) return;
    const t = setTimeout(() => {
      ref.current?.fitToCoordinates(
        listings.map((l) => ({ latitude: l.lat, longitude: l.lng })),
        { edgePadding: { top: topPadding + 40, bottom: bottomPadding + 40, left: 40, right: 40 }, animated: true },
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return (
    <MapView
      ref={ref}
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={NORTH}
      onPress={(e) => {
        if (e.nativeEvent.action !== "marker-press") onSelect(null);
      }}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      userInterfaceStyle="light"
      mapPadding={{ top: topPadding, bottom: bottomPadding, left: 0, right: 0 }}
    >
      {listings.map((l) => {
        const on = l.id === selected;
        const price = money.show(l.price, listingCurrency(l));
        return (
          <Marker
            key={`${l.id}-${on ? 1 : 0}-${price.text}`}
            coordinate={{ latitude: l.lat, longitude: l.lng }}
            onPress={() => onSelect(l.id)}
            tracksViewChanges={Platform.OS === "android"}
            zIndex={on ? 10 : 1}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.pin, on && styles.pinOn]}>
              <Text style={[styles.pinText, on && { color: "#fff" }]}>{price.converted ? `≈${price.text}` : price.text}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

/** One cottage's spot, for its page. Not interactive; tapping the frame opens the phone's maps app. */
export function PinMap({ lat, lng, style }: { lat: number; lng: number; style?: ViewStyle }) {
  return (
    <MapView
      style={style}
      initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.2 }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsPointsOfInterests={false}
      userInterfaceStyle="light"
      pointerEvents="none"
    >
      <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <View style={styles.home}>
          <Logo size={26} color="#fff" />
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinOn: { backgroundColor: colors.ink, transform: [{ scale: 1.08 }] },
  pinText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  home: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
