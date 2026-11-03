"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { NearbyPlace } from "@/lib/nearby";
import styles from "./guest.module.css";

export type AreaMapProps = {
  lat: number;
  lng: number;
  places: NearbyPlace[];
  activeKey: string | null;
  label: string;
  cottageLabel: string;
  onHover: (key: string | null) => void;
};

const home = L.divIcon({
  className: "stugora-pin-wrap",
  html: '<span class="stugora-home" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z"/></svg></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const numbered = (n: number, active: boolean) =>
  L.divIcon({
    className: "stugora-pin-wrap",
    html: `<span class="stugora-dot${active ? " is-active" : ""}">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

/** Zooms to show the cottage and every place listed beside the map. */
function Fit({ lat, lng, places }: { lat: number; lng: number; places: NearbyPlace[] }) {
  const map = useMap();
  const key = places.map((p) => p.key).join();
  useEffect(() => {
    if (!places.length) {
      map.setView([lat, lng], 11);
      return;
    }
    map.fitBounds(L.latLngBounds([[lat, lng], ...places.map((p) => [p.lat, p.lng] as [number, number])]), {
      padding: [28, 28],
      maxZoom: 13,
    });
    // `key` changes whenever the set of places does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, lat, lng]);
  return null;
}

export default function AreaMapLeaflet({ lat, lng, places, activeKey, label, cottageLabel, onHover }: AreaMapProps) {
  const icons = useMemo(() => places.map((p, i) => numbered(i + 1, p.key === activeKey)), [places, activeKey]);
  return (
    <MapContainer className={styles.areaMap} center={[lat, lng]} zoom={11} scrollWheelZoom={false} aria-label={label}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.wikipedia.org/">Wikipedia</a>'
        maxZoom={18}
      />
      <Fit lat={lat} lng={lng} places={places} />
      <Marker position={[lat, lng]} icon={home} zIndexOffset={2000}>
        <Tooltip direction="top" offset={[0, -16]}>
          {cottageLabel}
        </Tooltip>
      </Marker>
      {places.map((p, i) => (
        <Marker
          key={p.key}
          position={[p.lat, p.lng]}
          icon={icons[i]}
          zIndexOffset={p.key === activeKey ? 1000 : 0}
          eventHandlers={{
            mouseover: () => onHover(p.key),
            mouseout: () => onHover(null),
            click: () => window.open(p.url, "_blank", "noopener"),
          }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            {p.title}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
