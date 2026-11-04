"use client";

import { AdvancedMarker, Circle, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import { GoogleMaps, PLAIN } from "@/lib/googleMaps";
import s from "./editor.module.css";
import { PIN_ZOOM, type PinMapProps, viewKey } from "./PinMapLeaflet";

type LL = google.maps.LatLngLiteral;

function View({ point, suggestion, bounds }: Pick<PinMapProps, "point" | "suggestion" | "bounds">) {
  const map = useMap();
  const key = viewKey(point, suggestion, bounds);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    if (last.current === key) {
      // Same view; a pin moved by the owner stays in sight without the map jumping.
      if (point && !map.getBounds()?.contains(point)) map.panTo(point);
      return;
    }
    last.current = key;
    const target = point ?? suggestion;
    if (target) {
      map.setCenter(target);
      if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
    } else {
      map.fitBounds({ south: bounds[0], west: bounds[1], north: bounds[2], east: bounds[3] }, 12);
    }
  }, [map, key, point, suggestion, bounds]);
  return null;
}

function House({ suggested }: { suggested?: boolean }) {
  return (
    <span className="stugora-home" data-suggested={suggested || undefined} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z" />
      </svg>
    </span>
  );
}

/** The owner places the cottage: tap or click the map, or drag the pin. With `approximate`,
 *  the circle shows the area guests see before they book. Read-only when `onChange` is absent. */
export default function PinMapGoogle({ point, suggestion, bounds, approximate, label, onChange }: PinMapProps) {
  const pick = (ll: LL | google.maps.LatLng | null | undefined) => {
    if (!ll || !onChange) return;
    onChange(typeof ll.lat === "function" ? (ll as google.maps.LatLng).toJSON() : (ll as LL));
  };
  const start = point ?? suggestion;
  return (
    <GoogleMaps>
      <Map
        {...PLAIN}
        className={s.map}
        {...(start
          ? { defaultCenter: start, defaultZoom: PIN_ZOOM }
          : { defaultBounds: { south: bounds[0], west: bounds[1], north: bounds[2], east: bounds[3], padding: 12 } })}
        gestureHandling="cooperative"
        clickableIcons={false}
        onClick={(e) => pick(e.detail.latLng)}
        aria-label={label}
      >
        <View point={point} suggestion={suggestion} bounds={bounds} />
        {point && approximate ? (
          <Circle center={point} radius={700} strokeColor="#1d4c3c" strokeWeight={1} fillColor="#1d4c3c" fillOpacity={0.12} clickable={false} />
        ) : null}
        {point && (!approximate || onChange) ? (
          <AdvancedMarker position={point} draggable={Boolean(onChange)} onDragEnd={(e) => pick(e.latLng)} anchorLeft="-50%" anchorTop="-50%">
            <House />
          </AdvancedMarker>
        ) : null}
        {!point && suggestion ? (
          <AdvancedMarker position={suggestion} draggable={Boolean(onChange)} onDragEnd={(e) => pick(e.latLng)} anchorLeft="-50%" anchorTop="-50%">
            <House suggested />
          </AdvancedMarker>
        ) : null}
      </Map>
    </GoogleMaps>
  );
}
