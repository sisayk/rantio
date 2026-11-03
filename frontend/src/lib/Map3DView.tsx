"use client";
// Google's photorealistic 3D map, opened with the "Show in 3D" button. Loaded only when
// someone presses it: 3D map loads are billed separately (Google Cloud caps them per day).

import { GestureHandling, Map3D, MapMode, Marker } from "@vis.gl/react-google-maps/3d";
import type { CSSProperties } from "react";

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

const RED = "#e5484d";
const GREEN = "#1f7a55";

// The marker is real HTML (crisp at any screen density): a dark rounded label with the
// price above a pin. Inline styles, because the marker isn't inside the page's CSS modules.
const LABEL: CSSProperties = {
  display: "block",
  padding: "6px 12px",
  borderRadius: 999,
  border: "1.5px solid rgba(255, 255, 255, 0.55)",
  background: "rgba(29, 42, 46, 0.92)",
  color: "#fff",
  font: "700 15px/1.2 system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
};

function PinContent({ text, kind, clickable }: { text: string; kind: "cottage" | "place"; clickable: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: clickable ? "pointer" : "default" }}>
      <span style={LABEL}>{text}</span>
      <svg
        width={30}
        height={42}
        viewBox="0 0 30 42"
        aria-hidden="true"
        style={{ display: "block", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
      >
        <path
          d="M15 41C15 41 1.5 26 1.5 15a13.5 13.5 0 0 1 27 0C28.5 26 15 41 15 41Z"
          fill={kind === "cottage" ? RED : GREEN}
          stroke="#fff"
          strokeWidth={2}
        />
        {kind === "cottage" ? (
          <path d="M8.5 15.5 15 9.8l6.5 5.7v7.2h-4.4v-4.6h-4.2v4.6H8.5v-7.2Z" fill="#fff" />
        ) : (
          <circle cx={15} cy={15} r={4.5} fill="#fff" />
        )}
      </svg>
    </div>
  );
}

export default function Map3DView({
  lat,
  lng,
  range,
  pins,
  className,
  label,
  tilt = 30,
}: {
  lat: number;
  lng: number;
  range: number;
  pins: Pin3D[];
  className: string;
  label: string;
  /** 0 is straight down, like the flat map; a little tilt shows the land in relief. */
  tilt?: number;
}) {
  return (
    <div className={className} role="region" aria-label={label}>
      <Map3D
        mode={MapMode.HYBRID}
        defaultCenter={{ lat, lng, altitude: 0 }}
        defaultRange={range}
        defaultTilt={tilt}
        defaultHeading={0}
        gestureHandling={GestureHandling.GREEDY}
        defaultUIHidden={false}
        style={{ width: "100%", height: "100%" }}
      >
        {pins.map((p) => (
          <Marker
            key={p.key}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.title ?? p.label}
            anchorLeft="-50%"
            anchorTop="-100%"
            collisionBehavior={p.required ? "REQUIRED" : "OPTIONAL_AND_HIDES_LOWER_PRIORITY"}
            onClick={p.onClick}
          >
            <PinContent text={p.label} kind={p.kind ?? "cottage"} clickable={Boolean(p.onClick)} />
          </Marker>
        ))}
      </Map3D>
    </div>
  );
}
