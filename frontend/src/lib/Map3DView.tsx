"use client";
// Google's photorealistic 3D map, opened with the "Show in 3D" button. Loaded only when
// someone presses it: 3D map loads are billed separately (Google Cloud caps them per day).

import { GestureHandling, Map3D, MapMode, Marker3D } from "@vis.gl/react-google-maps/3d";

export type Pin3D = {
  key: string;
  lat: number;
  lng: number;
  /** Short text on the map: a price or a number. */
  label: string;
  /** The longer text shown when pointing at the pin (the cottage's or the place's name). */
  title?: string;
  /** Always drawn; other pins' labels give way where they would overlap. */
  required?: boolean;
  onClick?: () => void;
};

/** Distance in metres the camera keeps from the centre so the whole box is in view. */
export function rangeFor(bounds: google.maps.LatLngBoundsLiteral): number {
  const lat = (bounds.north + bounds.south) / 2;
  const tall = (bounds.north - bounds.south) * 111_000;
  const wide = (bounds.east - bounds.west) * 111_000 * Math.cos((lat * Math.PI) / 180);
  return Math.min(4_000_000, Math.max(1_500, Math.max(tall, wide) * 1.4));
}

export default function Map3DView({
  lat,
  lng,
  range,
  pins,
  className,
  label,
}: {
  lat: number;
  lng: number;
  range: number;
  pins: Pin3D[];
  className: string;
  label: string;
}) {
  return (
    <div className={className} role="region" aria-label={label}>
      <Map3D
        mode={MapMode.HYBRID}
        defaultCenter={{ lat, lng, altitude: 0 }}
        defaultRange={range}
        defaultTilt={range > 200_000 ? 35 : 62}
        defaultHeading={15}
        gestureHandling={GestureHandling.GREEDY}
        defaultUIHidden={false}
        style={{ width: "100%", height: "100%" }}
      >
        {pins.map((p) => (
          <Marker3D
            key={p.key}
            position={{ lat: p.lat, lng: p.lng }}
            label={p.label}
            title={p.title ?? p.label}
            collisionBehavior={p.required ? "REQUIRED" : "OPTIONAL_AND_HIDES_LOWER_PRIORITY"}
            onClick={p.onClick}
          />
        ))}
      </Map3D>
    </div>
  );
}
