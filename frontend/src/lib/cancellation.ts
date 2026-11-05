// Cancellation policies the host chooses, the same four Airbnb offers (2025–26), so hosts
// know them already and each booking site gets the closest match. Shared by the website
// and the apps; the backend keeps the same keys (backend/owners/models.py CancellationPolicy).
//
// Every policy: a full refund within 24 hours of booking when the stay starts at least
// 7 days later, as on Airbnb. Stays of 28 nights or more follow the long-stay policy.

import type { CancellationText } from "@/i18n/messages/cancellation";

export const POLICIES = ["flexible", "moderate", "limited", "firm"] as const;
export type Policy = (typeof POLICIES)[number];
export const LONG_POLICIES = ["firm", "strict"] as const;
export type LongPolicy = (typeof LONG_POLICIES)[number];

export const DEFAULT_POLICY: Policy = "moderate";
export const DEFAULT_LONG_POLICY: LongPolicy = "firm";
export const LONG_STAY_NIGHTS = 28;
export const NON_REFUNDABLE_DISCOUNT = 10; // percent, as on Airbnb

/** Days before check-in that still give a full refund, and a 50 % refund. */
const FULL_DAYS: Record<Policy, number> = { flexible: 1, moderate: 5, limited: 14, firm: 30 };
const HALF_DAYS: Partial<Record<Policy, number>> = { limited: 7, firm: 7 };

export const isPolicy = (v: unknown): v is Policy => (POLICIES as readonly unknown[]).includes(v);
export const isLongPolicy = (v: unknown): v is LongPolicy => (LONG_POLICIES as readonly unknown[]).includes(v);

/** The guest site's "Free cancellation" filter: a full refund until a few days before. */
export const freeCancellation = (p: Policy) => p === "flexible" || p === "moderate";

const shift = (day: string, days: number) => {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
};

export type Deadline = { kind: "full" | "half"; day: string };

/** The stay's own cancellation dates ("YYYY-MM-DD", at the check-in time on that day), the
 *  ones still ahead of `today` only. Long stays have their own rule and no dates here. */
export function deadlines(policy: Policy, checkIn: string, today: string): Deadline[] {
  const out: Deadline[] = [{ kind: "full", day: shift(checkIn, FULL_DAYS[policy]) }];
  const half = HALF_DAYS[policy];
  if (half) out.push({ kind: "half", day: shift(checkIn, half) });
  return out.filter((d) => d.day > today);
}

/** A policy for demo listings without one: free cancellation means Moderate, otherwise Firm. */
export const policyFromFeatures = (features: readonly string[]): Policy => (features.includes("freeCancellation") ? "moderate" : "firm");

/** What a guest reads about cancelling: the policy's own dates when the stay is known, else
 *  its rule. `day` writes a "YYYY-MM-DD" the page's way ("9 Nov"); `time` is the check-in time. */
export function guestLines(
  t: CancellationText,
  o: { policy: Policy; longPolicy: LongPolicy; checkIn: string | null; nights: number; today: string; time: string; day: (iso: string) => string },
): string[] {
  const fill = (s: string, date: string) => s.replace("{date}", o.day(date)).replace("{time}", o.time);
  if (o.nights >= LONG_STAY_NIGHTS) return [`${t.longTitle}: ${t.longRules[o.longPolicy]}`];
  if (!o.checkIn) return [t.rules[o.policy], t.late[o.policy]];
  const lines = deadlines(o.policy, o.checkIn, o.today).map((d) => fill(d.kind === "full" ? t.fullBefore : t.halfBefore, d.day));
  lines.push(t.late[o.policy]);
  return lines;
}
