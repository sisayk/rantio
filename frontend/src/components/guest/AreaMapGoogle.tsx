"use client";

import { AdvancedMarker, ControlPosition, Map, MapControl, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { fitWithin, GoogleMaps, PLAIN, toBounds } from "@/lib/googleMaps";
import type { NearbyPlace } from "@/lib/nearby";
import type { AreaMapProps } from "./AreaMapLeaflet";
import styles from "./guest.module.css";

/** Zooms to show the cottage and every place listed beside the map. */
function Fit({ lat, lng, places }: { lat: number; lng: number; places: NearbyPlace[] }) {
  const map = useMap();
  const key = places.map((p) => p.key).join();
  useEffect(() => {
    if (!map) return;
    if (!places.length) {
      map.setCenter({ lat, lng });
      map.setZoom(11);
      return;
    }
    return fitWithin(map, toBounds([[lat, lng], ...places.map((p) => [p.lat, p.lng] as [number, number])]), 28, 13);
    // `key` changes whenever the set of places does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, lat, lng]);
  return null;
}

export default function AreaMapGoogle({ lat, lng, places, activeKey, label, cottageLabel, onHover }: AreaMapProps) {
  return (
    <GoogleMaps>
      <Map {...PLAIN} className={styles.areaMap} defaultCenter={{ lat, lng }} defaultZoom={11} gestureHandling="cooperative" aria-label={label}>
        <Fit lat={lat} lng={lng} places={places} />
        <AdvancedMarker position={{ lat, lng }} zIndex={2000} anchorLeft="-50%" anchorTop="-50%" title={cottageLabel}>
          <span className="stugora-home" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 11 12 4l8 7v9h-5v-5h-6v5H4v-9Z" />
            </svg>
          </span>
        </AdvancedMarker>
        {places.map((p, i) => (
          <AdvancedMarker
            key={p.key}
            position={{ lat: p.lat, lng: p.lng }}
            zIndex={p.key === activeKey ? 1000 : 1}
            anchorLeft="-50%"
            anchorTop="-50%"
            title={p.title}
            onMouseEnter={() => onHover(p.key)}
            onMouseLeave={() => onHover(null)}
            onClick={() => window.open(p.url, "_blank", "noopener")}
          >
            <span className={`stugora-dot${p.key === activeKey ? " is-active" : ""}`}>{i + 1}</span>
          </AdvancedMarker>
        ))}
        <MapControl position={ControlPosition.BOTTOM_LEFT}>
          <span className={styles.mapCredit}>
            Places: <a href="https://www.wikipedia.org/">Wikipedia</a>
          </span>
        </MapControl>
      </Map>
    </GoogleMaps>
  );
}
