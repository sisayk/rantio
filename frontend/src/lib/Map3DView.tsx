"use client";
// Google's photorealistic 3D map, opened with the "Show in 3D" button. Loaded only when
// someone presses it: 3D map loads are billed separately (Google Cloud caps them per day).

import { GestureHandling, Map3D, MapMode, Marker3D } from "@vis.gl/react-google-maps/3d";

export type Pin3D = {
  key: string;
  lat: number;
  lng: number;
  /** Short text in the dark label above the pin: a price or a number. */
  label: string;
  /** The longer text shown when pointing at the pin (the cottage's or the place's name). */
  title?: string;
  /** A cottage (red pin with a house) or a nearby place (green pin). */
  kind?: "cottage" | "place";
  /** Always drawn; other pins give way where they would overlap. */
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

const RED = "#e5484d";
const GREEN = "#1f7a55";
const INK = "#1d2a2e";

/**
 * The marker as one picture (3D markers take an SVG, not HTML): a dark rounded label with
 * the price above a pin. The pin's tip is the bottom of the picture, which Google puts on
 * the spot.
 */
function PinGraphic({ text, kind }: { text: string; kind: "cottage" | "place" }) {
  const labelW = Math.max(44, Math.round(text.length * 9.2 + 26));
  const w = labelW + 4;
  const cx = w / 2;
  const h = 34 + 6 + 42;
  const color = kind === "cottage" ? RED : GREEN;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect
        x={cx - labelW / 2}
        y={2}
        width={labelW}
        height={30}
        rx={15}
        fill={INK}
        fillOpacity={0.92}
        stroke="#ffffff"
        strokeOpacity={0.55}
        strokeWidth={1.5}
      />
      <text x={cx} y={22} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={15} fontWeight={700} fill="#ffffff">
        {text}
      </text>
      {/* the pin: a drop shape with a white rim, 30 wide, its tip at the bottom */}
      <g transform={`translate(${cx - 15} 40)`}>
        <path d="M15 41C15 41 1.5 26 1.5 15a13.5 13.5 0 0 1 27 0C28.5 26 15 41 15 41Z" fill={color} stroke="#ffffff" strokeWidth={2} />
        {kind === "cottage" ? (
          <path d="M8.5 15.5 15 9.8l6.5 5.7v7.2h-4.4v-4.6h-4.2v4.6H8.5v-7.2Z" fill="#ffffff" />
        ) : (
          <circle cx={15} cy={15} r={4.5} fill="#ffffff" />
        )}
      </g>
    </svg>
  );
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
        defaultTilt={range > 200_000 ? 40 : 62}
        defaultHeading={0}
        gestureHandling={GestureHandling.GREEDY}
        defaultUIHidden={false}
        style={{ width: "100%", height: "100%" }}
      >
        {pins.map((p) => (
          <Marker3D
            key={p.key}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.title ?? p.label}
            collisionBehavior={p.required ? "REQUIRED" : "OPTIONAL_AND_HIDES_LOWER_PRIORITY"}
            onClick={p.onClick}
          >
            <PinGraphic text={p.label} kind={p.kind ?? "cottage"} />
          </Marker3D>
        ))}
      </Map3D>
    </div>
  );
}
