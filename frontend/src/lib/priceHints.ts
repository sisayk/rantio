// "Lower price" and "higher price" days in the search calendar, like Airbnb's.
// The same demand Rantio's pricing follows (backend/owners/pricing.py: holidays): nights are
// usually pricier at Christmas, midsummer, Easter, in the school ski and autumn weeks and on
// summer weekends, and usually cheaper on quiet weeknights outside the seasons. A general guide;
// each cottage's own price shows on its page.

export type PriceHint = "low" | "high" | null;

const parse = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Western Easter Sunday (anonymous Gregorian algorithm), as in pricing.py. */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** ISO week number. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const DAY = 86400000;

/** A holiday or school break the night falls in (Finland, Sweden and Norway's school weeks). */
function holiday(d: Date): boolean {
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, day = d.getUTCDate();
  if ((mo === 12 && day >= 22) || (mo === 1 && day <= 1)) return true; // Christmas to New Year
  if (mo === 6) {
    // Midsummer: the Thursday to Saturday around the Friday between 19 and 26 June.
    const friday = [19, 20, 21, 22, 23, 24, 25].map((n) => new Date(Date.UTC(y, 5, n))).find((x) => x.getUTCDay() === 5)!;
    if (Math.abs(d.getTime() - friday.getTime()) <= DAY) return true;
  }
  const e = easter(y).getTime();
  if (d.getTime() >= e - 3 * DAY && d.getTime() <= e + DAY) return true; // Maundy Thursday to Easter Monday
  const week = isoWeek(d);
  return (week >= 7 && week <= 10) || week === 42; // ski weeks, autumn week
}

/** Mid-June to mid-August: the summer cottage season. */
const summer = (d: Date) => {
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return md >= 615 && md <= 815;
};

/** The night starting on this day ("YYYY-MM-DD"). */
export function priceHint(day: string): PriceHint {
  const d = parse(day);
  const weekday = d.getUTCDay(); // 0 Sunday … 6 Saturday
  const weekend = weekday === 5 || weekday === 6;
  if (holiday(d) || (summer(d) && weekend)) return "high";
  // A quiet weeknight (Sunday to Wednesday; Thursdays start long weekends) outside the summer,
  // the holidays and the run-up to Christmas.
  const mo = d.getUTCMonth() + 1;
  if (weekday <= 3 && !summer(d) && !(mo === 12 && d.getUTCDate() >= 15)) return "low";
  return null;
}
