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
  unread_messages: number;
};

export type ChatMessage = { id: number; sender: "guest" | "host"; body: string; at: string };

export type ConversationRow = {
  id: number;
  guest_name: string;
  guest_language: string;
  cottage: string;
  channel: string;
  channel_label: string;
  replies_here: boolean;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  archived: boolean;
  unread: boolean;
  last_at: string | null;
  preview: { sender: "guest" | "host"; body: string } | null;
};

export type Thread = ConversationRow & {
  host_name: string;
  listing_slug: string;
  messages: ChatMessage[];
  viewer: "guest" | "host";
};

export type Enquiry = {
  listing: string;
  name: string;
  email: string;
  lang: string;
  body: string;
  check_in?: string | null;
  check_out?: string | null;
  guests?: number | null;
  website?: string;
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
  conversations: () => call<{ results: ConversationRow[]; unread: number }>("owner/conversations/"),
  thread: (id: number) => call<Thread>(`owner/conversations/${id}/`),
  reply: (id: number, body: string) =>
    call<Thread>(`owner/conversations/${id}/`, { method: "POST", body: JSON.stringify({ body }) }),
  /** Claude's suggestion for the reply box; nothing is sent to the guest. */
  draft: (id: number, notes: string, draft: string) =>
    call<{ draft: string }>(`owner/conversations/${id}/draft/`, { method: "POST", body: JSON.stringify({ notes, draft }) }),
  archive: (id: number, archived: boolean) =>
    call<ConversationRow>(`owner/conversations/${id}/`, { method: "PATCH", body: JSON.stringify({ archived }) }),
};

/** The guest's side: no account, the conversation's token is the key. */
export const guestApi = {
  enquire: (e: Enquiry) => call<{ token: string }>("enquiries/", { method: "POST", body: JSON.stringify(e) }),
  thread: (token: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`),
  send: (token: string, body: string) =>
    call<Thread>(`conversations/${encodeURIComponent(token)}/`, { method: "POST", body: JSON.stringify({ body }) }),
};

