// Maps on iPhone: Apple Maps (react-native-maps). Android has its own, in maps.android.tsx.
// Cottages show as price pins, as on Airbnb's map.
import { Component, type ComponentRef, type ReactNode, useEffect, useRef } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import type MapViewType from "react-native-maps";
import type { MapMarker } from "react-native-maps";

import { type Listing, listingCurrency } from "@/lib/listings";
import { useMoney } from "@/state/money";
import { colors, fonts } from "@/theme";
import { Icon, Logo, Text } from "@/ui/kit";

// Loaded on first use, so an app build that doesn't carry the map yet shows a
// placeholder instead of failing to start.
type Maps = { MapView: typeof MapViewType; Marker: typeof MapMarker };
let maps: Maps | null | undefined;
function loadMaps(): Maps | null {
  if (maps === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("react-native-maps");
      maps = { MapView: mod.default, Marker: mod.Marker };
    } catch {
      maps = null;
    }
  }
  return maps;
}

function NoMap({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name="map-outline" size={40} color={colors.faint} />
    </View>
  );
}

/** A map that fails to draw (e.g. its native part is missing) falls back to the placeholder. */
class MapBoundary extends Component<{ children: ReactNode; style?: ViewStyle }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <NoMap style={this.props.style} /> : this.props.children;
  }
}

/** Finland to Iceland and the Baltics. */
const NORTH = { latitude: 62, longitude: 15, latitudeDelta: 22, longitudeDelta: 40 };

export function CottagesMap(props: CottagesMapProps) {
  return (
    <MapBoundary style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <CottagesMapInner {...props} />
    </MapBoundary>
  );
}

type CottagesMapProps = {
  listings: Listing[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  style?: ViewStyle;
  bottomPadding?: number;
  topPadding?: number;
};

function CottagesMapInner({
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
  const ref = useRef<ComponentRef<typeof MapViewType>>(null);
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

  const lib = loadMaps();
  if (!lib) return <NoMap style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...style }} />;
  const { MapView, Marker } = lib;
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
export function PinMap(props: { lat: number; lng: number; style?: ViewStyle }) {
  return (
    <MapBoundary style={props.style}>
      <PinMapInner {...props} />
    </MapBoundary>
  );
}

function PinMapInner({ lat, lng, style }: { lat: number; lng: number; style?: ViewStyle }) {
  const lib = loadMaps();
  if (!lib) return <NoMap style={style} />;
  const { MapView, Marker } = lib;
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
          <Logo size={44} />
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
    borderRadius: 13,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
