// An amenity's icon in the app, from the same registry as the website (lib/amenityIcons.ts),
// drawn with react-native-svg so both show the identical icon.
import type { ComponentType } from "react";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

import { amenityIcon, type IconElement } from "@/lib/amenityIcons";
import { colors } from "@/theme";

const ELEMENTS = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, ellipse: Ellipse, polygon: Polygon } as const;

export function AmenityIcon({ amenity, size = 24, color = colors.green }: { amenity: string; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {amenityIcon(amenity).map(([tag, attrs]: IconElement, i) => {
        const El = ELEMENTS[tag] as unknown as ComponentType<Record<string, string | number>>;
        return <El key={i} {...attrs} />;
      })}
    </Svg>
  );
}
