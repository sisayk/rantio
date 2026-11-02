// An amenity's icon on the website, from the shared registry (lib/amenityIcons.ts).
import { createElement } from "react";
import { amenityIcon } from "@/lib/amenityIcons";

export default function AmenityIcon({ amenity, size = 24, className }: { amenity: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-amenity={amenity}
    >
      {amenityIcon(amenity).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
