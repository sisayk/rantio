"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Bounds } from "@/lib/regionBounds";
import s from "./editor.module.css";

const HOUSE = '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z"/></svg>';
const home = L.divIcon({
  className: "stugora-pin-wrap",
  html: `<span class="stugora-home" aria-hidden="true">${HOUSE}</span>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});
const suggested = L.divIcon({
  className: "stugora-pin-wrap",
  html: `<span class="stugora-home" data-suggested="true" aria-hidden="true">${HOUSE}</span>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

type Point = { lat: number; lng: number };

export type PinMapProps = {
  /** The cottage's pin: saved, or placed by the owner and not saved yet. */
  point: Point | null;
  /** A position proposed from the address, shown faded until the owner uses or moves it. */
  suggestion: Point | null;
  /** [south, west, north, east] to show when there is neither: the region, else the country. */
  bounds: Bounds;
  approximate: boolean;
  label: string;
  onChange?: (p: Point) => void;
};

export const PIN_ZOOM = 15;

/** Which view the map should open on: changes only when what it should show changes. */
export function viewKey(point: Point | null, suggestion: Point | null, bounds: Bounds) {
  if (point) return "pin";
  if (suggestion) return `suggestion:${suggestion.lat},${suggestion.lng}`;
  return `bounds:${bounds.join(",")}`;
}

function Clicks({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function View({ point, suggestion, bounds }: Pick<PinMapProps, "point" | "suggestion" | "bounds">) {
  const map = useMap();
  const key = viewKey(point, suggestion, bounds);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === key) {
      // Same view; a pin moved by the owner stays in sight without the map jumping.
      if (point && !map.getBounds().pad(-0.1).contains([point.lat, point.lng])) map.panTo([point.lat, point.lng]);
      return;
    }
    last.current = key;
    const target = point ?? suggestion;
    if (target) map.setView([target.lat, target.lng], Math.max(map.getZoom(), PIN_ZOOM));
    else map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: [12, 12] });
  }, [map, key, point, suggestion, bounds]);
  return null;
}

/** The owner places the cottage: tap or click the map, or drag the pin. With `approximate`,
 *  the circle shows the area guests see before they book. Read-only when `onChange` is absent. */
export default function PinMapLeaflet({ point, suggestion, bounds, approximate, label, onChange }: PinMapProps) {
  const handlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const ll = (e.target as L.Marker).getLatLng();
        onChange?.({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );
  const start = point ?? suggestion;
  return (
    <MapContainer
      className={s.map}
      {...(start
        ? { center: [start.lat, start.lng] as [number, number], zoom: PIN_ZOOM }
        : { bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] as [[number, number], [number, number]] })}
      scrollWheelZoom={false}
      zoomSnap={0.5}
      aria-label={label}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onChange ? <Clicks onPick={onChange} /> : null}
      <View point={point} suggestion={suggestion} bounds={bounds} />
      {point && approximate ? (
        <Circle center={[point.lat, point.lng]} radius={700} pathOptions={{ color: "#1d4c3c", weight: 1, fillOpacity: 0.12 }} />
      ) : null}
      {point && (!approximate || onChange) ? (
        <Marker position={[point.lat, point.lng]} icon={home} draggable={Boolean(onChange)} eventHandlers={handlers} />
      ) : null}
      {!point && suggestion ? (
        <Marker position={[suggestion.lat, suggestion.lng]} icon={suggested} draggable={Boolean(onChange)} eventHandlers={handlers} />
      ) : null}
    </MapContainer>
  );
}
