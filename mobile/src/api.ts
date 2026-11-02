// Calls to Rantio's Django API. Owners send their app sign-in key as a Bearer header;
// guests need no account (a conversation's private token is the key).
import Constants from "expo-constants";
import { NativeModules } from "react-native";

import type {
  BookingLinkInfo,
  BookingRequestForm,
  BookingRow,
  CalendarCottage,
  CalendarData,
  CalendarFeed,
  ConversationRow,
  Enquiry,
  EnquiryDraft,
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
  Summary,
  Thread,
} from "@/lib/ownerApi";

/** Metro's host:port. Expo's tools pass it as hostUri; an app started from Xcode or Android
 *  Studio doesn't get that, so the address its code was loaded from is used instead. */
function devServer(): string {
  const fromExpo = Constants.expoConfig?.hostUri;
  if (fromExpo) return fromExpo;
  try {
    const source = NativeModules.SourceCode as { getConstants?: () => { scriptURL?: string }; scriptURL?: string } | undefined;
    const url = source?.getConstants?.().scriptURL ?? source?.scriptURL ?? "";
    return url.match(/^https?:\/\/([^/?#]+)/)?.[1] ?? "";
  } catch {
    return "";
  }
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

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const ownerApi = {
  requestCode: (email: string, lang: string) =>
    call<{ sent: boolean; dev_code?: string }>("auth/request-code/", json("POST", { email, lang })),
  verifyCode: (email: string, code: string, device: string, platform: string) =>
    call<{ ok: boolean; token: string }>("auth/verify-code/", json("POST", { email, code, app: true, device, platform })),
  me: () => call<{ name: string; email: string; language: string; is_pilot: boolean }>("owner/me/", { owner: true }),
  setLanguage: (language: string) =>
    call<{ language: string }>("owner/me/", { ...json("PATCH", { language }), owner: true }),
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
};

export const guestApi = {
  enquire: (e: Enquiry) => call<{ token: string }>("enquiries/", json("POST", e)),
  draftEnquiry: (e: EnquiryDraft) => call<{ draft: string }>("enquiries/draft/", json("POST", e)),
  thread: (token: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`),
  send: (token: string, body: string) => call<Thread>(`conversations/${encodeURIComponent(token)}/`, json("POST", { body })),
  bookingLink: (token: string) => call<BookingLinkInfo>(`book/${encodeURIComponent(token)}/`),
  requestBooking: (token: string, form: BookingRequestForm) =>
    call<{ token: string }>(`book/${encodeURIComponent(token)}/`, json("POST", form)),
  rates: () => call<{ rates: Record<string, number>; date?: string }>("rates/"),
};
