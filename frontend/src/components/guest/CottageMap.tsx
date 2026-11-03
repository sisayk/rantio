"use client";
// The map of cottages: Google Maps when the site has a key, OpenStreetMap otherwise.
import { GOOGLE_MAPS_KEY } from "@/lib/googleMaps";
import CottageMapGoogle from "./CottageMapGoogle";
import CottageMapLeaflet from "./CottageMapLeaflet";

export type { CottageMapProps, MapFocus } from "./CottageMapLeaflet";
export default GOOGLE_MAPS_KEY ? CottageMapGoogle : CottageMapLeaflet;
