"use client";

import { AdvancedMarker, ControlPosition, Map, MapControl, useMap } from "@vis.gl/react-google-maps";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fitWithin, GoogleMaps, PLAIN, toBounds } from "@/lib/googleMaps";
import type { NearbyPlace } from "@/lib/nearby";
import type { AreaMapProps } from "./AreaMapLeaflet";
import styles from "./guest.module.css";

const Map3DView = dynamic(() => import("@/lib/Map3DView"), {
  ssr: false,
  loading: () => <div className={styles.areaMap} />,
});

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

export default function AreaMapGoogle({ lat, lng, places, activeKey, label, cottageLabel, onHover, show3d, show2d }: AreaMapProps) {
  const [threeD, setThreeD] = useState(false);
  const toggle = (
    <button type="button" className={styles.map3dToggle} aria-pressed={threeD} onClick={() => setThreeD(!threeD)}>
      {threeD ? (show2d ?? "2D") : (show3d ?? "3D")}
    </button>
  );
  if (threeD) {
    return (
      <GoogleMaps>
        <div className={styles.mapWrap}>
          {/* Close in, around the cottage: the lake, the forest, the terrain. */}
          <Map3DView
            className={styles.areaMap}
            label={label}
            lat={lat}
            lng={lng}
            range={2500}
            pins={[
              { key: "cottage", lat, lng, label: cottageLabel },
              ...places.map((p, i) => ({
                key: p.key,
                lat: p.lat,
                lng: p.lng,
                label: `${i + 1}. ${p.title}`,
                onClick: () => window.open(p.url, "_blank", "noopener"),
              })),
            ]}
          />
          {toggle}
        </div>
      </GoogleMaps>
    );
  }
  return (
    <GoogleMaps>
      <div className={styles.mapWrap}>
        <Map
          {...PLAIN}
          className={styles.areaMap}
          defaultCenter={{ lat, lng }}
          defaultZoom={11}
          gestureHandling="cooperative"
          aria-label={label}
        >
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
        {toggle}
      </div>
    </GoogleMaps>
  );
}
