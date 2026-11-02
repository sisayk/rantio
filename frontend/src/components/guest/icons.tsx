import type { Category } from "@/lib/listings";
import { useId } from "react";
import { MARK, WORDMARK } from "@/lib/brand";
import type { ActivityId } from "@/lib/activities";

type P = { className?: string };
const base = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Pin = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
);
export const CalendarIcon = ({ className }: P) => (
  <svg {...base(className)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13h2M14 13h2M8 16.5h2" /></svg>
);
export const People = ({ className }: P) => (
  <svg {...base(className)}><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M16 5.2a3 3 0 0 1 0 5.8M18 14.6c1.6.7 2.7 2.4 3 4.9" /></svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.2}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
);
export const Sliders = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const Chevron = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2}><path d="m7 10 5 5 5-5" /></svg>
);
export const ChevronLeft = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.4}><path d="m14.5 6-6 6 6 6" /></svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.4}><path d="m9.5 6 6 6-6 6" /></svg>
);
export const Close = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const GridIcon = ({ className }: P) => (
  <svg {...base(className)}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
);
export const Heart = ({ className, filled }: P & { filled?: boolean }) => (
  <svg {...base(className)} fill={filled ? "currentColor" : "none"} strokeWidth={2}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />
  </svg>
);
export const Globe = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z" /></svg>
);
export const UserIcon = ({ className }: P) => (
  <svg {...base(className)} fill="currentColor" stroke="none"><circle cx="12" cy="9" r="3.6" /><path d="M5.5 19c.9-3.2 3.4-5 6.5-5s5.6 1.8 6.5 5c-1.7 1.5-4 2.2-6.5 2.2S7.2 20.5 5.5 19Z" /></svg>
);
export const Bed = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 18.5V7M3 14h18v4.5M21 14v-2.5a2.5 2.5 0 0 0-2.5-2.5H11v5" /><rect x="5.5" y="9.5" width="3.5" height="2.5" rx="1" /></svg>
);
export const MapIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="m3.5 6.5 5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5V6.5Z" /><path d="M9 4v13.5M15 6.5V20" /></svg>
);
export const ListIcon = ({ className }: P) => (
  <svg {...base(className)}><rect x="3.5" y="4.5" width="7" height="6" rx="1.5" /><rect x="13.5" y="4.5" width="7" height="6" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="6" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="6" rx="1.5" /></svg>
);
export const Star = ({ className }: P) => (
  <svg {...base(className)} fill="currentColor" stroke="none"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z" /></svg>
);

const categoryPaths: Record<Category, React.ReactNode> = {
  all: <><path d="M4 11 12 4l8 7" /><path d="M6.5 9.5V20h11V9.5" /><path d="M10.5 20v-5h3v5" /></>,
  waterfront: <><path d="M3 9c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0M3 13.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" /></>,
  forest: <><path d="m8 3-4 6h2.5L4 13h3l-2.5 4h7L9 13h3l-2.5-4H12L8 3ZM8 17v4" /><path d="m16.5 6-3.3 5h2l-2.2 3.5h2.5L13.3 18h6.4l-2.2-3.5H20l-2.2-3.5h2L16.5 6ZM16.5 18v3" /></>,
  modern: <><path d="M3.5 20h17M5 20V10l7-5 7 5v10" /><path d="M9 20v-6h6v6M5 10h14" /></>,
  traditional: <><path d="M3 11 12 4l9 7M5 9.5V20h14V9.5" /><path d="M9.5 20v-4.5h5V20M8 12.5h2M14 12.5h2M12 4V2.5" /></>,
  sauna: <><path d="M4 20h16M6 20v-4h12v4" /><path d="M9 12c-1-1.3 1-2.3 0-3.6S9 6 9 6M12 12c-1-1.3 1-2.3 0-3.6S12 6 12 6M15 12c-1-1.3 1-2.3 0-3.6S15 6 15 6" /></>,
  aurora: <><path d="M12 3c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6Z" /><path d="M18.5 15c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" /></>,
  skiing: <><path d="M5 19 19 5M8 21 21 8" /><path d="m4 15 3 3M7 12l3 3M15 4l3 3" /></>,
  pets: <><ellipse cx="12" cy="16" rx="4" ry="3.3" /><circle cx="6.5" cy="10.5" r="1.8" /><circle cx="17.5" cy="10.5" r="1.8" /><circle cx="9.5" cy="6.5" r="1.8" /><circle cx="14.5" cy="6.5" r="1.8" /></>,
  family: <><circle cx="8" cy="7.5" r="2.6" /><circle cx="16" cy="7.5" r="2.6" /><path d="M3 19c.4-3.4 2.4-5.4 5-5.4s4.6 2 5 5.4M11 19c.4-3.4 2.4-5.4 5-5.4s4.6 2 5 5.4" /></>,
  unique: <><path d="M7 4h10l3.5 5L12 20 3.5 9 7 4Z" /><path d="M3.5 9h17M9.5 4 8 9l4 11 4-11-1.5-5" /></>,
};

export const CategoryIcon = ({ category, className }: P & { category: Category }) => (
  <svg {...base(className)} strokeWidth={1.4}>{categoryPaths[category]}</svg>
);

/** Rantio's mark: the app icon (green square, R with a house, orange pin). */
export const Logo = ({ className }: P) => {
  const id = `rantio-green-${useId().replace(/\W/g, "")}`;
  return (
    <svg className={className} viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={MARK.green[0]} />
          <stop offset="1" stopColor={MARK.green[1]} />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx={MARK.radius} fill={`url(#${id})`} />
      <g transform={MARK.transform}>
        <path d={MARK.white} fill="#fff" fillRule="evenodd" />
        <path d={MARK.pin} fill={MARK.orange} fillRule="evenodd" />
      </g>
    </svg>
  );
};

/** "Rantio" with a pin for the dot of the i. Its box is the letters only (as tall as the
 *  surrounding font size), so it lines up with text beside it; the pin rises above the box. */
export const Wordmark = ({ className }: P) => (
  <svg
    className={className}
    viewBox={`0 ${WORDMARK.lettersTop} ${WORDMARK.width} ${WORDMARK.height - WORDMARK.lettersTop}`}
    style={{ height: "1em", width: "auto", display: "block", overflow: "visible" }}
    role="img"
    aria-label="Rantio"
  >
    <path d={WORDMARK.word} fill={WORDMARK.green} fillRule="evenodd" />
    <path d={WORDMARK.pin} fill={WORDMARK.yellow} fillRule="evenodd" />
  </svg>
);

const wave = "M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0";
const activityPaths: Record<ActivityId, React.ReactNode> = {
  swim: <><circle cx="15.5" cy="6.5" r="2" /><path d="m5 13 4.5-3.5 3 2.5 3-1.5" /><path d={wave} /></>,
  beach: <><path d="M12 20V9" /><path d="M4.5 9.5a7.5 7.5 0 0 1 15 0h-15Z" /><path d="M3 20.5h18" /></>,
  sauna: categoryPaths.sauna,
  rowing: <><path d="M3 14h18l-2.5 4h-13L3 14Z" /><path d="m7 7 10 10M5.5 5.5l2 2" /><path d={wave} transform="translate(0 2.5)" /></>,
  paddling: <><path d="M2.5 15.5c3 1.5 16 1.5 19 0-3-1.5-16-1.5-19 0Z" /><path d="m6 6 12 12M4.5 4.5 7 7M17 17l2.5 2.5" /></>,
  fishing: <><path d="M4 20 15 4" /><path d="M15 4c3 1 5 4 5 8v4" /><path d="M20 16a1.5 1.5 0 1 1-3 0" /></>,
  iceFishing: <><path d="M3 15h18" /><ellipse cx="12" cy="15" rx="3" ry="1" /><path d="M12 3v11M9 5h6" /><path d="M12 15v3.5a1.5 1.5 0 0 1-3 0" /></>,
  hiking: <><path d="m3 20 6-10 4 6 2.5-3.5L21 20H3Z" /><circle cx="17" cy="6" r="2" /></>,
  foraging: <><circle cx="8" cy="15" r="3" /><circle cx="14.5" cy="16.5" r="2.5" /><circle cx="12.5" cy="10.5" r="2.5" /><path d="M12.5 8c0-2 1-3.5 3-4.5M15.5 3.5c1.5.5 2.5 1.5 3 3-2 .5-3.5 0-4.5-1" /></>,
  downhill: categoryPaths.skiing,
  crossCountry: <><circle cx="14" cy="4.5" r="1.8" /><path d="m9 21 2.5-7.5L9 10l4-2.5 2.5 3 3 1M11.5 13.5l3.5 2.5-1 5" /><path d="M2.5 20.5h19M6 9l-2 11.5" /></>,
  snowshoe: <><ellipse cx="8" cy="12" rx="3.5" ry="7" /><ellipse cx="16" cy="12" rx="3.5" ry="7" /><path d="M5 10h6M5 14h6M13 10h6M13 14h6" /></>,
  aurora: categoryPaths.aurora,
  hotTub: <><path d="M3.5 12h17v3.5a4.5 4.5 0 0 1-4.5 4.5H8a4.5 4.5 0 0 1-4.5-4.5V12Z" /><path d="M8 9c-.8-1 .8-2 0-3M12 9c-.8-1 .8-2 0-3M16 9c-.8-1 .8-2 0-3" /></>,
  campfire: <><path d="M12 3c2.5 3 4.5 5.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.8.8-3.2 2-4.3.2 1.6 1 2.6 2 2.8-.5-2.5 0-4.8.5-7Z" /><path d="m4 21 16-4M20 21 4 17" /></>,
  fireside: <><path d="M4 21V6l8-3 8 3v15" /><path d="M8 21v-7a4 4 0 0 1 8 0v7" /><path d="M12 20c-1.4 0-2-1-2-2 0-1.3 1-1.8 2-3.5 1 1.7 2 2.2 2 3.5 0 1-.6 2-2 2Z" /></>,
  dogs: categoryPaths.pets,
};

export const ActivityIcon = ({ activity, className }: P & { activity: ActivityId }) => (
  <svg {...base(className)} strokeWidth={1.5}>{activityPaths[activity]}</svg>
);

export const ArrowLeft = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const External = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={1.8}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const Check = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
