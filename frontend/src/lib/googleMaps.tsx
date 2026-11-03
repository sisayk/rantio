"use client";
// Google Maps on the website. The key is built into the site (NEXT_PUBLIC_GOOGLE_MAPS_KEY);
// it only works on rantio.fi because Google Cloud restricts it to that site. Without a key
// the maps stay on OpenStreetMap (Leaflet), e.g. in local development.

import { APIProvider } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
// Pins drawn as HTML need a map ID; Google's demo ID works until our own is set.
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

/** Google's code for the page's language (Norwegian is one language for Google Maps). */
function mapLanguage(): string {
  const lang = typeof document === "undefined" ? "en" : document.documentElement.lang || "en";
  return lang === "nb" || lang === "nn" ? "no" : lang;
}

export function GoogleMaps({ children }: { children: ReactNode }) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} language={mapLanguage()} region="FI">
      {children}
    </APIProvider>
  );
}

/** What every Rantio map leaves out: map/satellite switch, Street View, fullscreen, clickable shops. */
export const PLAIN = {
  mapId: GOOGLE_MAP_ID,
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
} as const;

/** Leaflet-style [[lat, lng], [lat, lng]] corners as Google bounds. */
export function toBounds(corners: [number, number][]): google.maps.LatLngBoundsLiteral {
  const lats = corners.map((c) => c[0]);
  const lngs = corners.map((c) => c[1]);
  return { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) };
}

/** Zooms to `bounds`, but never closer than `maxZoom` (Google's fitBounds has no cap of its own). */
export function fitWithin(map: google.maps.Map, bounds: google.maps.LatLngBoundsLiteral, padding: number, maxZoom: number) {
  map.fitBounds(bounds, padding);
  const once = google.maps.event.addListenerOnce(map, "idle", () => {
    if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
  });
  return () => once.remove();
}
