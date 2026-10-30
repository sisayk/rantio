"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import s from "./editor.module.css";

const home = L.divIcon({
  className: "stugora-pin-wrap",
  html: '<span class="stugora-home" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z"/></svg></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

type Point = { lat: number; lng: number };

function Clicks({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Follow({ center, zoom }: { center: Point; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), zoom));
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

/** The owner places the cottage: drag the pin or click the map. With `approximate`,
 *  the circle shows the area guests see before they book. Read-only when `onChange` is absent. */
export default function PinMap({
  point,
  fallback,
  approximate,
  label,
  onChange,
}: {
  point: Point | null;
  fallback: Point;
  approximate: boolean;
  label: string;
  onChange?: (p: Point) => void;
}) {
  const center = point ?? fallback;
  const handlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const ll = (e.target as L.Marker).getLatLng();
        onChange?.({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );
  return (
    <MapContainer className={s.map} center={[center.lat, center.lng]} zoom={point ? 13 : 9} scrollWheelZoom={false} aria-label={label}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onChange ? <Clicks onPick={onChange} /> : null}
      <Follow center={center} zoom={point ? 13 : 9} />
      {point && approximate ? (
        <Circle center={[point.lat, point.lng]} radius={700} pathOptions={{ color: "#1d4c3c", weight: 1, fillOpacity: 0.12 }} />
      ) : null}
      {point && (!approximate || onChange) ? (
        <Marker position={[point.lat, point.lng]} icon={home} draggable={Boolean(onChange)} eventHandlers={handlers} />
      ) : null}
    </MapContainer>
  );
}
