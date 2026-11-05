// Maps on Android: Google Maps, the same map and pins as the iPhone's, when the app was built
// with a Google Maps key (GOOGLE_MAPS_ANDROID_KEY in mobile/.env, read by app.config.js).
// Without one, OpenStreetMap in a web view, so the map still works.
import Constants from "expo-constants";

import * as Leaflet from "./mapsLeaflet";
import * as Native from "./mapsNative";

const google = Constants.expoConfig?.extra?.googleMapsAndroid === true;

export const CottagesMap = google ? Native.CottagesMap : Leaflet.CottagesMap;
export const PinMap = google ? Native.PinMap : Leaflet.PinMap;
