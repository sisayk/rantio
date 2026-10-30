// Calendar days as "YYYY-MM-DD" strings (as the API sends them), and their formats.
import { LANG_INFO, type Lang } from "@/i18n/locales";

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "2027-07-12" → a local Date at midnight (never shifted by time zones). */
export const parseISO = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export const todayISO = () => toISO(new Date());

export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;

export const addMonths = (s: string, n: number) => {
  const d = parseISO(monthStart(s));
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};

const cache = new Map<string, Intl.DateTimeFormat | null>();

function fmt(lang: Lang, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  const k = `${lang}|${JSON.stringify(options)}`;
  if (!cache.has(k)) {
    try {
      cache.set(k, new Intl.DateTimeFormat(LANG_INFO[lang].intl, options));
    } catch {
      cache.set(k, null);
    }
  }
  return cache.get(k) ?? null;
}

const fallback = (d: Date, options: Intl.DateTimeFormatOptions) =>
  options.hour ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;

/** Formats a day ("2027-07-12") or a timestamp in the language. */
export function formatDate(lang: Lang, value: string | Date, options: Intl.DateTimeFormatOptions): string {
  const d = typeof value === "string" ? (value.length <= 10 ? parseISO(value) : new Date(value)) : value;
  const f = fmt(lang, options);
  try {
    return f ? f.format(d) : fallback(d, options);
  } catch {
    return fallback(d, options);
  }
}

export const DAY = { day: "numeric", month: "short" } as const;
export const DAY_WEEKDAY = { weekday: "short", day: "numeric", month: "short" } as const;
export const DAY_LONG = { weekday: "long", day: "numeric", month: "long" } as const;
export const MONTH_YEAR = { month: "long", year: "numeric" } as const;
export const TIME = { hour: "2-digit", minute: "2-digit" } as const;

/** "12–14 Jul" style range: both days in the language's short format. */
export const formatRange = (lang: Lang, a: string, b: string) => `${formatDate(lang, a, DAY)} – ${formatDate(lang, b, DAY)}`;

/** Monday-first weekday initials for a month grid. */
export function weekdayNames(lang: Lang): string[] {
  const monday = new Date(2027, 6, 5);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(5 + i);
    return formatDate(lang, d, { weekday: "narrow" });
  });
}
