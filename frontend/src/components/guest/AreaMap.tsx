"use client";
// What's near a cottage: Google Maps when the site has a key, OpenStreetMap otherwise.
import { GOOGLE_MAPS_KEY } from "@/lib/googleMaps";
import AreaMapGoogle from "./AreaMapGoogle";
import AreaMapLeaflet from "./AreaMapLeaflet";

export type { AreaMapProps } from "./AreaMapLeaflet";
export default GOOGLE_MAPS_KEY ? AreaMapGoogle : AreaMapLeaflet;
