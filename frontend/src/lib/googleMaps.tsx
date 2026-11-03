"use client";
// Google Maps on the website. The key is built into the site (NEXT_PUBLIC_GOOGLE_MAPS_KEY);
// it only works on rantio.fi because Google Cloud restricts it to that site. Without a key
// the maps stay on OpenStreetMap (Leaflet), e.g. in local development.

import { APIProvider, useMap } from "@vis.gl/react-google-maps";
import { type ReactNode, type RefObject, useEffect } from "react";

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

/** Zooms to `bounds`, but never closer than `maxZoom` (Google's fitBounds has no cap of its own).
 *  Fits again when the map's box changes size in its first moments: a map that appears (the
 *  list/map switch, a dynamic import) is often first measured at 0 × 0, and Google then
 *  zooms out to the whole world. */
export function fitWithin(map: google.maps.Map, bounds: google.maps.LatLngBoundsLiteral, padding: number, maxZoom: number) {
  let once: google.maps.MapsEventListener | null = null;
  const fit = () => {
    const box = map.getDiv().getBoundingClientRect();
    if (box.width < 2 * padding + 10 || box.height < 2 * padding + 10) return; // not laid out yet
    once?.remove();
    map.fitBounds(bounds, padding);
    once = google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
    });
  };
  fit();
  // Only while the map is settling in, so a visitor who has moved the map isn't sent back.
  const settledBy = Date.now() + 2000;
  let size = "";
  const watcher = new ResizeObserver(([entry]) => {
    const now = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
    if (now !== size && Date.now() < settledBy) {
      size = now;
      fit();
    }
  });
  watcher.observe(map.getDiv());
  return () => {
    watcher.disconnect();
    once?.remove();
  };
}

/** Where the 3D map's camera starts so it shows what the flat map shows right now. */
export type Camera3D = { lat: number; lng: number; range: number };

const FOV_3D = 35; // the 3D map's default vertical field of view, in degrees

export function cameraOf(map: google.maps.Map): Camera3D | null {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const height = map.getDiv().clientHeight;
  if (!center || zoom == null || !height) return null;
  const lat = center.lat();
  // Ground metres per screen pixel at this zoom and latitude (Web Mercator), times the
  // map's height: the strip of ground the flat map shows top to bottom.
  const metres = ((156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom) * height;
  const range = metres / 2 / Math.tan(((FOV_3D / 2) * Math.PI) / 180);
  return { lat, lng: center.lng(), range };
}

/** Put inside a <Map>: keeps `mapRef` pointing at that map (the 3D button reads its view). */
export function GrabMap({ mapRef }: { mapRef: RefObject<google.maps.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}
