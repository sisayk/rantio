// Calls to Rantio's Django API. Owners send their app sign-in key as a Bearer header;
// guests need no account (a conversation's private token is the key).
import Constants from "expo-constants";
import { NativeModules, TurboModuleRegistry } from "react-native";

import type {
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
  ListingDetail,
  ListingFields,
  ListingPhoto,
  ListingSummary,
  PhotoKind,
  StatusAction,
  StayQuote,
  Summary,
  Thread,
} from "@/lib/ownerApi";

export type {
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
  ListingDetail,
  ListingFields,
  ListingPhoto,
  ListingStatus,
  ListingSummary,
  NightPriceRow,
  PhotoKind,
  PriceReason,
  StatusAction,
  StayQuote,
  Summary,
  Thread,
} from "@/lib/ownerApi";

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
  if (owner && (res.status === 401 || res.status === 403)) {
    onSignedOut?.();
    throw new SignedOut();
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
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
  if (res.status === 401 || res.status === 403) {
    onSignedOut?.();
    throw new SignedOut();
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(body.detail ?? `HTTP ${res.status}`), res.status, body);
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export type SignInTo = { email?: string; phone?: string };

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
  me: () => call<{ name: string; email: string; language: string; is_pilot: boolean }>("owner/me/", { owner: true }),
  setLanguage: (language: string) =>
    call<{ language: string }>("owner/me/", { ...json("PATCH", { language }), owner: true }),
  /** The Mökki monitor waitlist, joined with the email the owner signs in with. */
  monitor: () => call<{ joined: boolean }>("owner/monitor/", { owner: true }),
  joinMonitor: () => call<{ joined: boolean }>("owner/monitor/", { ...json("POST"), owner: true }),
  setPushToken: (push_token: string) => call<{ ok: boolean }>("owner/device/", { ...json("POST", { push_token }), owner: true }),
  logout: () => call<{ ok: boolean }>("auth/logout/", { ...json("POST"), owner: true }),
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
  bookingLink: (token: string) => call<BookingLinkInfo>(`book/${encodeURIComponent(token)}/`),
  quote: (token: string, checkIn: string, checkOut: string) =>
    call<StayQuote>(`book/${encodeURIComponent(token)}/quote/?check_in=${checkIn}&check_out=${checkOut}`),
  requestBooking: (token: string, form: BookingRequestForm) =>
    call<{ token: string }>(`book/${encodeURIComponent(token)}/`, json("POST", form)),
  rates: () => call<{ rates: Record<string, number>; date?: string }>("rates/"),
};
