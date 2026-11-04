// The owner dashboard's calls to Django, made through this site's /api proxy.

import type { OtherListing } from "@/i18n/messages/otherListings";

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
  currency: string; // the cottage's: EUR, SEK, NOK, DKK or ISK
  charged: boolean;
  commission: Money;
  commission_vat: Money;
  cancelled: boolean;
  staying_now: boolean;
};

export type Summary = {
  owner: { name: string; first_name: string; email: string; language: string; is_pilot: boolean; commission_rate: string };
  /** The owner's currency; bookings and totals are in it. Each yearly fee is in its cottage's currency. */
  currency: string;
  rate: { per_eur: string; date: string | null } | null;
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
    status: ListingStatus;
    status_label: string;
    currency: string;
    price_per_night: Money;
    listing_started_on: string | null;
    listing_year: number | null;
    next_fee_on: string | null;
    next_fee: Money | null;
    /** The last free day while the free trial runs. */
    trial_until?: string | null;
    bookings: number;
    nights: number;
    payout: Money;
    occupancy: number | null;
  }[];
  fees: { cottage: string; currency: string; listing_year: number; starts_on: string; fee: Money; vat: Money; fee_local: Money }[];
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
  children: number;
  /** Set for a booking request sent through the owner's booking link. */
  request_status: "" | "pending" | "accepted" | "declined";
  guest_phone: string;
  booking_id: number | null;
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
  /** For the owner, while a booking request waits for an answer. */
  request?: BookingRequestRow | null;
};

export type CalendarEntry = {
  /** booking: a stay from any site; site: dates taken on a site we read by calendar link;
   *  block: dates the owner closed; request: a booking request waiting for an answer. */
  kind: "booking" | "site" | "block" | "request";
  id: number;
  cottage_id: number;
  start: string; // first night
  end: string; // check-out day, the first free day
  channel: string;
  label: string;
  guests: number | null;
  note: string;
};

export type CalendarFeed = {
  id: number;
  cottage_id: number;
  channel: string;
  label: string;
  url: string;
  last_synced_at: string | null;
  last_error: string;
};

export type CalendarCottage = {
  id: number;
  name: string;
  status: string;
  currency: string;
  price_per_night: Money;
  cleaning_fee: Money;
  min_nights: number;
  max_guests: number;
  booking_link: string;
  booking_requests_open: boolean;
  forwarding_address: string;
  export: Record<"airbnb" | "booking" | "vrbo" | "agoda" | "all", string>;
  feeds: CalendarFeed[];
};

export type BookingRequestRow = {
  id: number;
  cottage_id: number;
  guest_name: string;
  guest_phone: string;
  guest_language: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  message: string;
  estimate: Money;
  currency: string;
  free: boolean;
  created_at: string;
};

/** Why a night costs what it does (backend owners/pricing.py). */
export type PriceReason =
  | "override" | "smart" | "season" | "weekend" | "christmas" | "midsummer" | "easter" | "winter_holiday" | "autumn_holiday"
  | "summer" | "demand_high" | "demand_up" | "demand_low" | "last_minute" | "gap" | "min" | "max";

/** One night's price: the owner's own for that date (override), smart pricing's, or the usual price. */
export type NightPriceRow = {
  date: string;
  price: Money;
  /** What smart pricing would ask, shown as a suggestion when it is off. */
  suggested: Money;
  override: boolean;
  reasons: PriceReason[];
  base?: Money;
  free?: boolean;
};

export type CottagePrices = {
  currency: string;
  price_per_night?: Money;
  smart_pricing: boolean;
  smart_min_price?: Money;
  smart_max_price?: Money;
  nights: NightPriceRow[];
};

export type CalendarData = {
  today: string;
  from: string;
  to: string;
  cottages: CalendarCottage[];
  entries: CalendarEntry[];
  /** Pairs of "kind-id" keys of entries that overlap: double bookings. */
  conflicts: [string, string][];
  requests: BookingRequestRow[];
  /** Each night's price, by cottage id. */
  prices: Record<string, CottagePrices>;
};

/** A stay's price through the booking link. */
export type StayQuote = {
  currency: string;
  nights: { date: string; price: Money }[];
  subtotal: Money;
  discount_percent: number;
  discount: Money;
  cleaning_fee: Money;
  total: Money;
};

/** What a guest with an owner's booking link sees. */
export type BookingLinkInfo = {
  name: string;
  municipality: string;
  country: string;
  listing_slug: string;
  host: string;
  max_guests: number;
  min_nights: number;
  max_nights: number;
  price_per_night: Money;
  cleaning_fee: Money;
  currency: string;
  open: boolean;
  today: string;
  busy: [string, string][];
};

export type BookingRequestForm = {
  name: string;
  email: string;
  phone: string;
  lang: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  body: string;
  website?: string;
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
  adults?: number | null;
  children?: number | null;
  website?: string;
};

/** What the AI writing help gets: the stay so far and the guest's own few words. */
export type EnquiryDraft = {
  listing: string;
  cottage?: string;
  place?: string;
  lang: string;
  name?: string;
  check_in?: string | null;
  check_out?: string | null;
  adults?: number | null;
  children?: number | null;
  draft?: string;
};

export type PhotoKind = "exterior" | "living" | "bedroom" | "kitchen" | "sauna" | "outside";
export type ListingPhoto = { id: number; url: string; kind: PhotoKind; caption: string };
export type ListingStatus = "intake" | "listing" | "live" | "paused" | "archived";
export type PropertyType = "cottage" | "cabin" | "villa" | "holiday_home" | "apartment" | "farmhouse" | "other";
export type ChecklistKey =
  | "cover" | "description" | "location" | "price" | "photos" | "pin" | "amenities" | "rules" | "arrival" | "availability";
export type ChannelState = "connected" | "attention" | "failed" | "pending" | "not_connected" | "email";
export type ListingChannel = {
  channel: "airbnb" | "booking" | "vrbo" | "agoda" | "nettimokki";
  state: ChannelState;
  last_synced_at: string | null;
  error: string;
  url: string;
  feed_id: number | null;
};
export type ListingStay = { id: number; channel: string; check_in: string; check_out: string; guests: number };

/** One of the owner's properties in My listings. */
export type ListingSummary = {
  id: number;
  name: string;
  property_type: PropertyType;
  country: string;
  region: string;
  municipality: string;
  status: ListingStatus;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  price_per_night: Money;
  currency: string;
  cover: string | null;
  photo_count: number;
  amenity_count: number;
  has_description: boolean;
  completeness: number;
  missing: ChecklistKey[];
  channels: ListingChannel[];
  attention: boolean;
  updated_at: string;
  upcoming_count: number;
  next_check_in: string | null;
  next_check_out: string | null;
  occupancy_30: number;
  upcoming: ListingStay[];
};

export type NearbyKind =
  | "lake" | "beach" | "ski" | "hiking" | "grocery" | "restaurant" | "transport" | "evCharging" | "airport" | "station" | "other";
export type Nearby = { kind: NearbyKind; name: string; distance_km: string | null };
export type Season = { name: string; start: string; end: string; price: Money };
export type AmenityNote = { note: string; fee: Money | null };

/** Everything the owner edits in the listing editor. */
export type ListingFields = {
  name: string;
  property_type: PropertyType;
  country: string;
  /** One of the country's regions (lib/places.ts ids), or "" when not chosen. */
  region: string;
  municipality: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  show_exact_location: boolean;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  floor_area: number | null;
  floors: number;
  host_languages: string[];
  descriptions: Record<string, string>;
  nearby: Nearby[];
  amenities: string[];
  amenity_notes: Record<string, AmenityNote>;
  min_nights: number;
  max_nights: number | null;
  price_per_night: Money;
  weekend_price: Money | null;
  cleaning_fee: Money;
  extra_guest_fee: Money;
  extra_guest_from: number | null;
  pet_fee: Money;
  weekly_discount: number;
  monthly_discount: number;
  security_deposit: Money;
  /** Smart pricing: nightly prices follow demand between these limits (empty: 75 % and 200 % of the price). */
  smart_pricing: boolean;
  smart_min_price: Money | null;
  smart_max_price: Money | null;
  seasonal_prices: Season[];
  taxes_note: string;
  check_in_from: string | null;
  check_in_until: string | null;
  check_out_by: string | null;
  self_check_in: boolean;
  min_age: number | null;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  events_allowed: boolean;
  quiet_hours: string;
  house_rules: string;
  waste_instructions: string;
  sauna_instructions: string;
  fireplace_instructions: string;
  arrival_instructions: string;
  departure_instructions: string;
  access_details: string;
};

export type ListingChange = { at: string; by: string; action: string; fields: string[] };

export type ListingDetail = ListingSummary &
  ListingFields & {
    checklist: { key: ChecklistKey; done: boolean; essential: boolean }[];
    photos: ListingPhoto[];
    history: ListingChange[];
    booking_link_open: boolean;
    forwarding_address: string;
    nettimokki_url: string;
    links: OtherListing[];
  };

/** The listing as guests see it: no address, codes or arrival notes; the location rounded unless shown exactly. */
export type ListingPreview = Omit<ListingDetail, "address" | "arrival_instructions" | "departure_instructions" | "access_details" | "history" | "checklist" | "channels"> & {
  busy: { start: string; end: string }[];
};

export type StatusAction = "publish" | "pause" | "relist" | "archive" | "restore";

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

/** A photo upload with progress: multipart, so the browser sets the content type and boundary. */
function sendPhoto(url: string, file: Blob, name: string, fields: Record<string, string>, onProgress?: (pct: number) => void) {
  return new Promise<ListingPhoto>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, name);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-CSRFToken", csrfToken());
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        body = {};
      }
      if (xhr.status === 401 || xhr.status === 403) reject(new SignedOut());
      else if (xhr.status >= 200 && xhr.status < 300) resolve(body as ListingPhoto);
      else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { status: xhr.status, body }));
    };
    xhr.onerror = () => reject(Object.assign(new Error("network"), { status: 0, body: {} }));
    xhr.send(form);
  });
}

export const ownerApi = {
  listings: () => call<{ cottages: ListingSummary[] }>("owner/cottages/"),
  createListing: (name: string) => call<ListingDetail>("owner/cottages/", { method: "POST", body: JSON.stringify({ name }) }),
  listing: (id: number) => call<ListingDetail>(`owner/cottages/${id}/`),
  listingPreview: (id: number) => call<ListingPreview>(`owner/cottages/${id}/preview/`),
  /** A suggested pin for the address: only a suggestion, never saved by itself. */
  geocode: (q: { address: string; municipality: string; country: string }) =>
    call<{ found: boolean; lat?: number; lng?: number; label?: string }>(`owner/geocode/?${new URLSearchParams(q)}`),
  saveListing: (id: number, fields: Partial<ListingFields>) =>
    call<ListingDetail>(`owner/cottages/${id}/`, { method: "PATCH", body: JSON.stringify(fields) }),
  setListingStatus: (id: number, action: StatusAction) =>
    call<ListingDetail>(`owner/cottages/${id}/status/`, { method: "POST", body: JSON.stringify({ action }) }),
  duplicateListing: (id: number) => call<ListingDetail>(`owner/cottages/${id}/duplicate/`, { method: "POST" }),
  deleteListing: (id: number, confirm: string) =>
    call<Record<string, never>>(`owner/cottages/${id}/`, { method: "DELETE", body: JSON.stringify({ confirm }) }),
  addPhoto: (cottage: number, file: Blob, name: string, kind: PhotoKind, onProgress?: (pct: number) => void) =>
    sendPhoto(`/api/owner/cottages/${cottage}/photos/`, file, name, { kind }, onProgress),
  replacePhoto: (cottage: number, photo: number, file: Blob, name: string, onProgress?: (pct: number) => void) =>
    sendPhoto(`/api/owner/cottages/${cottage}/photos/${photo}/replace/`, file, name, {}, onProgress),
  updatePhoto: (cottage: number, photo: number, fields: { kind?: PhotoKind; caption?: string }) =>
    call<ListingPhoto>(`owner/cottages/${cottage}/photos/${photo}/`, { method: "PATCH", body: JSON.stringify(fields) }),
  removePhoto: (cottage: number, photo: number) =>
    call<Record<string, never>>(`owner/cottages/${cottage}/photos/${photo}/`, { method: "DELETE" }),
  orderPhotos: (cottage: number, ids: number[]) =>
    call<{ photos: ListingPhoto[] }>(`owner/cottages/${cottage}/photos/order/`, { method: "POST", body: JSON.stringify({ ids }) }),
  /** A code by email ({ email }) or by SMS ({ phone: "+358…" }). */
  requestCode: (to: { email?: string; phone?: string }, lang: string) =>
    call<{ sent: boolean; dev_code?: string }>("auth/request-code/", { method: "POST", body: JSON.stringify({ ...to, lang }) }),
  verifyCode: (to: { email?: string; phone?: string }, code: string) =>
    call<{ ok: boolean }>("auth/verify-code/", { method: "POST", body: JSON.stringify({ ...to, code }) }),
  /** Which ways of signing in the server has switched on. */
  signInOptions: () => call<{ sms: boolean; google: boolean; apple: boolean }>("auth/options/"),
  /** Signs in with a Google or Apple ID token. */
  social: (provider: "google" | "apple", idToken: string, lang?: string) =>
    call<{ ok: boolean }>("auth/social/", { method: "POST", body: JSON.stringify({ provider, id_token: idToken, ...(lang ? { lang } : {}) }) }),
  me: () => call<{ name: string; email: string; is_host: boolean }>("owner/me/"),
  /** The Mökki monitor waitlist, joined with the email the owner signs in with. */
  monitor: () => call<{ joined: boolean }>("owner/monitor/"),
  joinMonitor: () => call<{ joined: boolean }>("owner/monitor/", { method: "POST" }),
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
  calendar: (from: string, months: number) => call<CalendarData>(`owner/calendar/?from=${from}&months=${months}`),
  closeDates: (cottage: number, start: string, end: string, note: string) =>
    call<{ id: number }>("owner/calendar/blocks/", { method: "POST", body: JSON.stringify({ cottage, start, end, note }) }),
  reopenDates: (id: number) => call<unknown>(`owner/calendar/blocks/${id}/`, { method: "DELETE" }),
  saveFeed: (cottage: number, channel: string, url: string) =>
    call<CalendarFeed>("owner/calendar/feeds/", { method: "POST", body: JSON.stringify({ cottage, channel, url }) }),
  removeFeed: (id: number) => call<unknown>(`owner/calendar/feeds/${id}/`, { method: "DELETE" }),
  addOtherListing: (cottage: number, url: string, calendarUrl: string) =>
    call<OtherListing>(`owner/cottages/${cottage}/links/`, {
      method: "POST",
      body: JSON.stringify(calendarUrl ? { url, calendar_url: calendarUrl } : { url }),
    }),
  setOtherListingCalendar: (id: number, calendarUrl: string) =>
    call<OtherListing>(`owner/links/${id}/`, { method: "PATCH", body: JSON.stringify({ calendar_url: calendarUrl }) }),
  removeOtherListing: (id: number) => call<unknown>(`owner/links/${id}/`, { method: "DELETE" }),
  setBookingLink: (cottage: number, open: boolean) =>
    call<CalendarCottage>(`owner/cottages/${cottage}/booking-link/`, { method: "PATCH", body: JSON.stringify({ open }) }),
  renewBookingLink: (cottage: number) => call<CalendarCottage>(`owner/cottages/${cottage}/booking-link/`, { method: "POST" }),
  prices: (cottage: number, from: string, days: number) => call<CottagePrices>(`owner/cottages/${cottage}/prices/?from=${from}&days=${days}`),
  /** A price for the nights start…end (end = the day after the last night); null: back to automatic. */
  setPrices: (cottage: number, start: string, end: string, price: string | null) =>
    call<CottagePrices>(`owner/cottages/${cottage}/prices/`, { method: "POST", body: JSON.stringify({ start, end, price }) }),
  acceptRequest: (id: number, payout: string) =>
    call<ConversationRow>(`owner/conversations/${id}/accept/`, { method: "POST", body: JSON.stringify({ payout }) }),
  declineRequest: (id: number) => call<ConversationRow>(`owner/conversations/${id}/decline/`, { method: "POST" }),
};

/** The guest's side: no account, the conversation's token is the key. */
export const guestApi = {
  enquire: (e: Enquiry) => call<{ token: string }>("enquiries/", { method: "POST", body: JSON.stringify(e) }),
  draftEnquiry: (e: EnquiryDraft) => call<{ draft: string }>("enquiries/draft/", { method: "POST", body: JSON.stringify(e) }),
  thread: (token: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`),
  send: (token: string, body: string) =>
    call<Thread>(`conversations/${encodeURIComponent(token)}/`, { method: "POST", body: JSON.stringify({ body }) }),
  bookingLink: (token: string) => call<BookingLinkInfo>(`book/${encodeURIComponent(token)}/`),
  quote: (token: string, checkIn: string, checkOut: string) =>
    call<StayQuote>(`book/${encodeURIComponent(token)}/quote/?check_in=${checkIn}&check_out=${checkOut}`),
  requestBooking: (token: string, form: BookingRequestForm) =>
    call<{ token: string }>(`book/${encodeURIComponent(token)}/`, { method: "POST", body: JSON.stringify(form) }),
};

