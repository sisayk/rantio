// Calls to Rantio's Django API. Owners send their app sign-in key as a Bearer header;
// guests need no account (a conversation's private token is the key).
import Constants from "expo-constants";
import { NativeModules, TurboModuleRegistry } from "react-native";

import type { OtherListing } from "@/i18n/messages/otherListings";
import type { fromApi } from "@/lib/prices";

import type {
  OwnerDetails,
  BookingLinkInfo,
  BookingRequestForm,
  BookingRow,
  CalendarCottage,
  CalendarData,
  CalendarFeed,
  ConversationRow,
  CottagePrices,
  Enquiry,
  EnquiryDraft,
  ExternalRating,
  ListingDetail,
  ListingFields,
  ListingPhoto,
  ListingSummary,
  OwnerReviews,
  PhotoKind,
  Ratings,
  ReviewRow,
  StatusAction,
  StayQuote,
  Summary,
  Thread,
} from "@/lib/ownerApi";

export type {
  OwnerDetails,
  BookingLinkInfo,
  BookingRequestForm,
  BookingRequestRow,
  BookingRow,
  CalendarCottage,
  CalendarData,
  CalendarEntry,
  CalendarFeed,
  ChatMessage,
  ConversationRow,
  CottagePrices,
  ExternalRating,
  ListingDetail,
  ListingFields,
  ListingPhoto,
  ListingStatus,
  ListingSummary,
  NightPriceRow,
  OwnerReviews,
  PhotoKind,
  PriceReason,
  Ratings,
  ReviewRow,
  StatusAction,
  StayQuote,
  Summary,
  Thread,
} from "@/lib/ownerApi";

/** The payment method Rantio's fees are charged to (owners/profile.py). */
export type PaymentMethod = { kind: string; brand: string; last4: string; exp_month: number | null; exp_year: number | null };

/** Metro's host:port. Expo's tools pass it as hostUri; an app started from Xcode or Android
 *  Studio doesn't get that, so the address its code was loaded from is used instead. */
function devServer(): string {
  const fromExpo = Constants.expoConfig?.hostUri;
  if (fromExpo) return fromExpo;
  try {
    type Source = { getConstants?: () => { scriptURL?: string } } | null | undefined;
    const source = (TurboModuleRegistry.get("SourceCode") ?? NativeModules.SourceCode) as Source;
    const found = (source?.getConstants?.().scriptURL ?? "").match(/^https?:\/\/([^/?#]+)/)?.[1];
    if (found) return found;
  } catch {
    // fall through
  }
  return "localhost:8081"; // a development build always loads from Metro; the simulator's is here
}

/**
 * While developing, the app calls the API on the same address it loads its code from
 * (Metro), and metro.config.js passes /api/ and /media/ on to Django on the Mac. Whatever
 * reaches Metro (simulator, emulator, a phone on the Wi-Fi, a tunnel) can then sign in.
 * Release builds talk to rantio.fi. EXPO_PUBLIC_API_URL in mobile/.env overrides both.
 */
const hostUri = __DEV__ ? devServer() : "";
const devHost = hostUri.split(":")[0];
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (hostUri ? `http://${hostUri}` : "https://rantio.fi")).replace(/\/$/, "");
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || (devHost ? `http://${devHost}:3100` : API_URL)).replace(/\/$/, "");

/** The server sends uploaded photos as "/media/…"; the app needs the whole address. */
export const mediaUrl = (url: string) => (url.startsWith("/") ? `${API_URL}${url}` : url);

export class SignedOut extends Error {}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}
/** No answer at all: the phone is offline or the server can't be reached. */
export class Offline extends Error {}

let key: string | null = null;
let onSignedOut: (() => void) | null = null;

export function setApiKey(k: string | null) {
  key = k;
}
export function onApiSignedOut(fn: () => void) {
  onSignedOut = fn;
}

async function call<T>(path: string, init: RequestInit & { owner?: boolean } = {}): Promise<T> {
  const { owner = false, ...rest } = init;
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (owner && key) headers.Authorization = `Bearer ${key}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/${path}`, { ...rest, headers: { ...headers, ...(rest.headers as object) } });
  } catch {
    throw new Offline("offline");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // 403 "not_host": signed in, just not hosting yet. Anything else 401/403 means signed out.
  if (owner && (res.status === 401 || res.status === 403) && body.detail !== "not_host") {
    onSignedOut?.();
    throw new SignedOut();
  }
  if (!res.ok) throw new ApiError(String(body.detail ?? `HTTP ${res.status}`), res.status, body);
  return body as T;
}

/** A multipart upload with the owner's key (the photo picker's files). */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/${path}`, { method: "POST", body: form, headers });
  } catch (e) {
    if (__DEV__) console.warn("[upload]", path, e); // what failed, in Metro's terminal
    throw new Offline("offline");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if ((res.status === 401 || res.status === 403) && body.detail !== "not_host") {
    onSignedOut?.();
    throw new SignedOut();
  }
  if (!res.ok) throw new ApiError(String(body.detail ?? `HTTP ${res.status}`), res.status, body);
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export type SignInTo = { email?: string; phone?: string };

export type MonitorKind = "frost" | "leak" | "power" | "sauna" | "door" | "battery" | "offline" | "arrival";
export type MonitorAlert = { id: number; kind: MonitorKind; started_at: string; ended_at: string | null; value: string };
export type MonitorSettings = { frost_limit: number; arrival_temp: number; sauna_hours: number };
export type MonitorLast = {
  at?: string;
  temp?: number | null;
  sauna?: number | null;
  humidity?: number | null;
  leak?: boolean | null;
  door?: boolean | null;
  mains?: boolean | null;
  battery?: number | null;
  signal?: number | null;
};
export type MonitorRow = {
  id: number;
  serial: string;
  name: string;
  cottage: { id: number; name: string } | null;
  online: boolean;
  last_seen_at: string | null;
  last: MonitorLast;
  firmware: string;
  occupied: boolean;
  alerts: MonitorAlert[];
  settings: MonitorSettings;
};
export type MonitorDetail = MonitorRow & { history: { at: string; temp: number | null; sauna: number | null }[]; recent_alerts: MonitorAlert[] };

export const ownerApi = {
  /** A code by email ({ email }) or by SMS ({ phone: "+358…" }). */
  requestCode: (to: SignInTo, lang: string) =>
    call<{ sent: boolean; dev_code?: string }>("auth/request-code/", json("POST", { ...to, lang })),
  verifyCode: (to: SignInTo, code: string, device: string, platform: string) =>
    call<{ ok: boolean; token: string }>("auth/verify-code/", json("POST", { ...to, code, app: true, device, platform })),
  /** Which ways of signing in the server has switched on. */
  signInOptions: () => call<{ sms: boolean; google: boolean; apple: boolean }>("auth/options/"),
  /** Signs in with an Apple or Google ID token; the app gets its own key back. */
  social: (provider: "apple" | "google", idToken: string, device: string, platform: string) =>
    call<{ ok: boolean; token: string }>("auth/social/", json("POST", { provider, id_token: idToken, app: true, device, platform })),
  me: () => call<{ name: string; email: string; language: string; is_pilot: boolean; is_host: boolean; phone?: string; photo?: string | null; details?: OwnerDetails }>("owner/me/", { owner: true }),
  setLanguage: (language: string) =>
    call<{ language: string }>("owner/me/", { ...json("PATCH", { language }), owner: true }),
  /** The Mökki monitor waitlist, joined with the email the owner signs in with. */
  monitor: () => call<{ joined: boolean }>("owner/monitor/", { owner: true }),
  joinMonitor: () => call<{ joined: boolean }>("owner/monitor/", { ...json("POST"), owner: true }),
  /** The host's Mökki monitor boxes (backend/owners/monitor.py). */
  monitors: () => call<MonitorRow[]>("owner/monitors/", { owner: true }),
  monitorDevice: (id: number) => call<MonitorDetail>(`owner/monitors/${id}/`, { owner: true }),
  claimMonitor: (serial: string, code: string, cottage: number | null) =>
    call<MonitorRow>("owner/monitors/", { ...json("POST", { serial, code, cottage }), owner: true }),
  updateMonitor: (id: number, fields: Partial<MonitorSettings> & { name?: string; cottage?: number | null }) =>
    call<MonitorRow>(`owner/monitors/${id}/`, { ...json("PATCH", fields), owner: true }),
  removeMonitor: (id: number) => call<Record<string, never>>(`owner/monitors/${id}/`, { ...json("DELETE"), owner: true }),
  setPushToken: (push_token: string) => call<{ ok: boolean }>("owner/device/", { ...json("POST", { push_token }), owner: true }),
  /** A one-time token to open rantio.fi signed in (ui/settings.tsx openSignedIn). */
  webLink: () => call<{ token: string; seconds: number }>("owner/app/web-link/", { ...json("POST", {}), owner: true }),
  logout: () => call<{ ok: boolean }>("auth/logout/", { ...json("POST"), owner: true }),
  /** Ends another key than the one in use (a sign-out that couldn't reach the server earlier). */
  logoutKey: async (old: string) => {
    const res = await fetch(`${API_URL}/api/auth/logout/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${old}` },
      body: "{}",
    });
    if (res.status === 401 || res.status === 403) throw new SignedOut();
    if (!res.ok) throw new Error(String(res.status));
  },
  updateMe: (fields: { name?: string; phone?: string; details?: Partial<OwnerDetails> }) =>
    call<{ name: string; email: string; language: string; is_pilot: boolean; is_host: boolean; phone?: string; photo?: string | null; details?: OwnerDetails }>(
      "owner/me/",
      { ...json("PATCH", fields), owner: true },
    ),
  setPhoto: async (uri: string) => {
    const { File } = await import("expo-file-system");
    const form = new FormData();
    form.append("file", new File(uri) as unknown as Blob);
    return upload<{ photo: string }>("owner/me/photo/", form);
  },
  removePhoto: () => call<{ photo: null }>("owner/me/photo/", { ...json("DELETE"), owner: true }),
  paymentMethod: () => call<{ available: boolean; method: PaymentMethod | null }>("owner/payment-method/", { owner: true }),
  newPaymentPage: () => call<{ url: string }>("owner/payment-method/", { ...json("POST", { app: true }), owner: true }),
  /** Deletes the signed-in account (owners/account.py). */
  deleteAccount: () => call<{ deleted: string }>("owner/me/", { ...json("DELETE"), owner: true }),
  summary: (year?: number) => call<Summary>(`owner/summary/${year ? `?year=${year}` : ""}`, { owner: true }),
  bookings: (year: number) => call<{ results: BookingRow[] }>(`owner/bookings/?year=${year}`, { owner: true }),
  conversations: () => call<{ results: ConversationRow[]; unread: number }>("owner/conversations/", { owner: true }),
  thread: (id: number) => call<Thread>(`owner/conversations/${id}/`, { owner: true }),
  reply: (id: number, body: string) => call<Thread>(`owner/conversations/${id}/`, { ...json("POST", { body }), owner: true }),
  draft: (id: number, notes: string, draft: string) =>
    call<{ draft: string }>(`owner/conversations/${id}/draft/`, { ...json("POST", { notes, draft }), owner: true }),
  assistant: () => call<{ enabled: boolean }>("owner/assistant/", { owner: true }),
  archive: (id: number, archived: boolean) =>
    call<ConversationRow>(`owner/conversations/${id}/`, { ...json("PATCH", { archived }), owner: true }),
  calendar: (from: string, months: number) =>
    call<CalendarData>(`owner/calendar/?from=${from}&months=${months}`, { owner: true }),
  closeDates: (cottage: number, start: string, end: string, note: string) =>
    call<{ id: number }>("owner/calendar/blocks/", { ...json("POST", { cottage, start, end, note }), owner: true }),
  reopenDates: (id: number) => call<unknown>(`owner/calendar/blocks/${id}/`, { ...json("DELETE"), owner: true }),
  saveFeed: (cottage: number, channel: string, url: string) =>
    call<CalendarFeed>("owner/calendar/feeds/", { ...json("POST", { cottage, channel, url }), owner: true }),
  removeFeed: (id: number) => call<unknown>(`owner/calendar/feeds/${id}/`, { ...json("DELETE"), owner: true }),
  otherListings: (cottage: number) => call<OtherListing[]>(`owner/cottages/${cottage}/links/`, { owner: true }),
  addOtherListing: (cottage: number, url: string, calendarUrl: string) =>
    call<OtherListing>(`owner/cottages/${cottage}/links/`, {
      ...json("POST", calendarUrl ? { url, calendar_url: calendarUrl } : { url }),
      owner: true,
    }),
  setOtherListingCalendar: (id: number, calendarUrl: string) =>
    call<OtherListing>(`owner/links/${id}/`, { ...json("PATCH", { calendar_url: calendarUrl }), owner: true }),
  removeOtherListing: (id: number) => call<unknown>(`owner/links/${id}/`, { ...json("DELETE"), owner: true }),
  reviews: (cottage: number) => call<OwnerReviews>(`owner/cottages/${cottage}/reviews/`, { owner: true }),
  replyToReview: (id: number, reply: string) => call<ReviewRow>(`owner/reviews/${id}/`, { ...json("PATCH", { reply }), owner: true }),
  addRating: (cottage: number, url: string, score: string, count: number) =>
    call<ExternalRating>(`owner/cottages/${cottage}/ratings/`, { ...json("POST", { url, score, count }), owner: true }),
  removeRating: (id: number) => call<unknown>(`owner/ratings/${id}/`, { ...json("DELETE"), owner: true }),
  setBookingLink: (cottage: number, open: boolean) =>
    call<CalendarCottage>(`owner/cottages/${cottage}/booking-link/`, { ...json("PATCH", { open }), owner: true }),
  renewBookingLink: (cottage: number) =>
    call<CalendarCottage>(`owner/cottages/${cottage}/booking-link/`, { ...json("POST"), owner: true }),
  acceptRequest: (id: number, payout: string) =>
    call<ConversationRow>(`owner/conversations/${id}/accept/`, { ...json("POST", { payout }), owner: true }),
  declineRequest: (id: number) => call<ConversationRow>(`owner/conversations/${id}/decline/`, { ...json("POST"), owner: true }),

  // ---------- listings: the same editor as Hosting → My listings on the website ----------
  listings: () => call<{ cottages: ListingSummary[] }>("owner/cottages/", { owner: true }),
  listing: (id: number) => call<ListingDetail>(`owner/cottages/${id}/`, { owner: true }),
  createListing: (name: string) => call<ListingDetail>("owner/cottages/", { ...json("POST", { name }), owner: true }),
  saveListing: (id: number, fields: Partial<ListingFields>) =>
    call<ListingDetail>(`owner/cottages/${id}/`, { ...json("PATCH", fields), owner: true }),
  /** AI fills the description in every language the owner hasn't written (see the backend's owners/translate.py). */
  translateListing: (id: number, source?: string) =>
    call<ListingDetail>(`owner/cottages/${id}/translate/`, { ...json("POST", source ? { source } : {}), owner: true }),
  setListingStatus: (id: number, action: StatusAction) =>
    call<ListingDetail>(`owner/cottages/${id}/status/`, { ...json("POST", { action }), owner: true }),
  /** A photo from the phone: `uri` is a local file (already resized). */
  addPhoto: async (cottage: number, uri: string, kind?: PhotoKind) => {
    // Expo's fetch sends a file given as a File (expo-file-system), not React Native's
    // { uri, name, type } object, which it rejects before anything is sent.
    const { File } = await import("expo-file-system");
    const form = new FormData();
    form.append("file", new File(uri) as unknown as Blob);
    if (kind) form.append("kind", kind);
    return upload<ListingPhoto>(`owner/cottages/${cottage}/photos/`, form);
  },
  updatePhoto: (cottage: number, photo: number, fields: { kind?: PhotoKind; caption?: string }) =>
    call<ListingPhoto>(`owner/cottages/${cottage}/photos/${photo}/`, { ...json("PATCH", fields), owner: true }),
  deletePhoto: (cottage: number, photo: number) =>
    call<Record<string, never>>(`owner/cottages/${cottage}/photos/${photo}/`, { ...json("DELETE"), owner: true }),
  orderPhotos: (cottage: number, ids: number[]) =>
    call<{ photos: ListingPhoto[] }>(`owner/cottages/${cottage}/photos/order/`, { ...json("POST", { ids }), owner: true }),

  // ---------- nightly prices and smart pricing ----------
  prices: (cottage: number, from: string, days: number) =>
    call<CottagePrices>(`owner/cottages/${cottage}/prices/?from=${from}&days=${days}`, { owner: true }),
  /** One price for the nights start…end (end: the morning after the last night); null: back to automatic. */
  setPrices: (cottage: number, start: string, end: string, price: string | null) =>
    call<CottagePrices>(`owner/cottages/${cottage}/prices/`, { ...json("POST", { start, end, price }), owner: true }),
};

export const guestApi = {
  enquire: (e: Enquiry) => call<{ token: string }>("enquiries/", json("POST", e)),
  draftEnquiry: (e: EnquiryDraft) => call<{ draft: string }>("enquiries/draft/", json("POST", e)),
  thread: (token: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`),
  send: (token: string, body: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`, json("POST", { body })),
  /** Where to push when the owner answers; an empty token stops the notifications. */
  setPush: (token: string, pushToken: string) =>
    call<{ ok: boolean }>(`conversations/${encodeURIComponent(token)}/push/`, json("POST", { push_token: pushToken })),
  /** Who answers a cottage page's messages: the owner, or the Rantio team for an example stay (state/answeredBy.ts). */
  contact: (slug: string) => call<{ answered_by: "owner" | "rantio" }>(`cottages/${encodeURIComponent(slug)}/contact/`),
  /** A cottage page's real ratings and host; 404 for the example cottages (ui/highlights.tsx). */
  about: (slug: string) =>
    call<{ ratings: Ratings; guest_favourite: boolean; host: { name: string; photo: string | null; since: number } | null }>(
      `cottages/${encodeURIComponent(slug)}/about/`,
    ),
  bookingLink: (token: string) => call<BookingLinkInfo>(`book/${encodeURIComponent(token)}/`),
  quote: (token: string, checkIn: string, checkOut: string) =>
    call<StayQuote>(`book/${encodeURIComponent(token)}/quote/?check_in=${checkIn}&check_out=${checkOut}`),
  requestBooking: (token: string, form: BookingRequestForm) =>
    call<{ token: string }>(`book/${encodeURIComponent(token)}/`, json("POST", form)),
  rates: () => call<{ rates: Record<string, number>; date?: string }>("rates/"),
  /** Rantio's prices as set in the admin (lib/usePrices.ts). */
  pricing: () => call<Parameters<typeof fromApi>[0]>("pricing/"),
  /** "List your cottage": the same sign-up as on rantio.fi/hosts, with its photos (local JPEG files).
   *  checkout_url, when set, is Stripe's page for saving a card for the free trial. */
  listCottage: async (fields: Record<string, string | number | boolean>, photos: string[]) => {
    const { File } = await import("expo-file-system");
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    for (const uri of photos) form.append("photos", new File(uri) as unknown as Blob);
    return upload<{ token: string; checkout_url: string | null; signed_in: boolean; app_key?: string }>("signups/", form);
  },
  /** The email check: a code to the address, sent back with the form as email_code. */
  signupEmailCode: (email: string, name: string, lang: string) =>
    call<{ sent: boolean }>("signups/email-code/", json("POST", { email, name, lang })),
  signupCard: (token: string) =>
    call<{ card_saved: boolean; name: string; card_step: boolean }>(`signups/${encodeURIComponent(token)}/card/`),
  newCardPage: (token: string) =>
    call<{ card_saved: boolean; checkout_url: string | null }>(`signups/${encodeURIComponent(token)}/card/`, json("POST", { app: true })),
};
