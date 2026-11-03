"use client";
// Where the cottage is: Google Maps when the site has a key, OpenStreetMap otherwise.
import { GOOGLE_MAPS_KEY } from "@/lib/googleMaps";
import PinMapGoogle from "./PinMapGoogle";
import PinMapLeaflet from "./PinMapLeaflet";

export type { PinMapProps } from "./PinMapLeaflet";
export default GOOGLE_MAPS_KEY ? PinMapGoogle : PinMapLeaflet;
