"use client";

import { AdvancedMarker, Circle, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { GoogleMaps, PLAIN } from "@/lib/googleMaps";
import s from "./editor.module.css";
import type { PinMapProps } from "./PinMapLeaflet";

function Follow({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.setCenter({ lat, lng });
    if ((map.getZoom() ?? 0) < zoom) map.setZoom(zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

/** The owner places the cottage: drag the pin or click the map. With `approximate`,
 *  the circle shows the area guests see before they book. Read-only when `onChange` is absent. */
export default function PinMapGoogle({ point, fallback, approximate, label, onChange }: PinMapProps) {
  const center = point ?? fallback;
  const zoom = point ? 13 : 9;
  const pick = (ll: google.maps.LatLngLiteral | google.maps.LatLng | null | undefined) => {
    if (!ll || !onChange) return;
    onChange(typeof ll.lat === "function" ? (ll as google.maps.LatLng).toJSON() : (ll as google.maps.LatLngLiteral));
  };
  return (
    <GoogleMaps>
      <Map
        {...PLAIN}
        className={s.map}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="cooperative"
        onClick={(e) => pick(e.detail.latLng)}
        aria-label={label}
      >
        <Follow lat={center.lat} lng={center.lng} zoom={zoom} />
        {point && approximate ? (
          <Circle center={point} radius={700} strokeColor="#1d4c3c" strokeWeight={1} fillColor="#1d4c3c" fillOpacity={0.12} clickable={false} />
        ) : null}
        {point && (!approximate || onChange) ? (
          <AdvancedMarker
            position={point}
            draggable={Boolean(onChange)}
            onDragEnd={(e) => pick(e.latLng)}
            anchorLeft="-50%"
            anchorTop="-50%"
          >
            <span className="stugora-home" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z" />
              </svg>
            </span>
          </AdvancedMarker>
        ) : null}
      </Map>
    </GoogleMaps>
  );
}
