// The owner dashboard's calls to Django, made through this site's /api proxy.

export type Money = string; // "1234.50"

export type BookingRow = {
  id: number;
  cottage: string;
  cottage_id: number;
  channel: string;
  channel_label: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  payout: Money;
  charged: boolean;
  commission: Money;
  commission_vat: Money;
  cancelled: boolean;
  staying_now: boolean;
};

export type Summary = {
  owner: { name: string; first_name: string; email: string; language: string; is_pilot: boolean; commission_rate: string };
  year: number;
  years: number[];
  today: string;
  totals: {
    bookings: number;
    nights: number;
    cancelled: number;
    payout: Money;
    payout_stugora: Money;
    payout_own: Money;
    commission: Money;
    commission_vat: Money;
    fees: Money;
    fees_vat: Money;
    stugora_total: Money;
    net: Money;
  };
  months: { month: number; stugora: Money; own: Money; nights: number }[];
  channels: { channel: string; label: string; charged: boolean; bookings: number; nights: number; payout: Money; commission: Money }[];
  cottages: {
    id: number;
    name: string;
    municipality: string;
    country: string;
    status: "intake" | "listing" | "live" | "paused";
    status_label: string;
    price_per_night: Money;
    listing_started_on: string | null;
    listing_year: number | null;
    next_fee_on: string | null;
    next_fee: Money | null;
    bookings: number;
    nights: number;
    payout: Money;
    occupancy: number | null;
  }[];
  fees: { cottage: string; listing_year: number; starts_on: string; fee: Money; vat: Money }[];
  upcoming: BookingRow[];
};

export class SignedOut extends Error {}

function csrfToken() {
  return document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1] ?? "";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), ...init.headers },
  });
  if (res.status === 401 || res.status === 403) throw new SignedOut();
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.detail ?? `HTTP ${res.status}`), { status: res.status, body });
  return body as T;
}

export const ownerApi = {
  requestCode: (email: string, lang: string) =>
    call<{ sent: boolean; dev_code?: string }>("auth/request-code/", { method: "POST", body: JSON.stringify({ email, lang }) }),
  verifyCode: (email: string, code: string) =>
    call<{ ok: boolean }>("auth/verify-code/", { method: "POST", body: JSON.stringify({ email, code }) }),
  me: () => call<{ name: string; email: string }>("owner/me/"),
  summary: (year?: number) => call<Summary>(`owner/summary/${year ? `?year=${year}` : ""}`),
  bookings: (year: number) => call<{ results: BookingRow[] }>(`owner/bookings/?year=${year}`),
  logout: () => call<{ ok: boolean }>("auth/logout/", { method: "POST" }),
};

export const dashboardHref = (lang: "fi" | "en") => (lang === "fi" ? "/hallinta" : "/en/hosting");
export const loginHref = (lang: "fi" | "en") => (lang === "fi" ? "/hallinta/kirjaudu" : "/en/hosting/login");
