// Push notifications. Owners: new bookings, guest messages and booking requests. Guests:
// the owner's answer in a conversation they follow in the app. The server sends them
// through Expo's push service to the token we register here.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { guestApi, ownerApi } from "@/api";

import { createPushSwitch, PushSyncError } from "./pushSwitch";

export { PushSyncError };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushState = "on" | "off" | "blocked" | "unavailable";

const projectId = () =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

async function ensureChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Rantio",
      importance: AndroidImportance.HIGH,
      lightColor: "#1d4c3c",
    });
  }
}

/** Account → Notifications, kept in step with the server (the rules are in pushSwitch.ts). */
const pushSwitch = createPushSwitch(AsyncStorage, (token) => ownerApi.setPushToken(token));

/** The push token, asking for permission first when `ask` (the system shows its own prompt); null without permission. */
async function tokenFor(id: string, ask: boolean): Promise<string | null> {
  await ensureChannel();
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask && canAskAgain) ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

async function permission(): Promise<PushState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "on" : canAskAgain ? "off" : "blocked";
}

/** Account settings' switch, off. The server first: throws PushSyncError, changing nothing, if it can't be reached. */
export async function turnPushOff(): Promise<PushState> {
  if (!Device.isDevice || !projectId()) return "unavailable";
  return pushSwitch.turnOff();
}

/** What the switch shows: the saved choice, unless the phone's own settings block notifications. */
export async function pushState(): Promise<PushState> {
  if (!Device.isDevice || !projectId()) return "unavailable";
  const allowed = await permission();
  if (allowed !== "on") return allowed;
  return (await pushSwitch.isOff()) ? "off" : "on";
}

/**
 * ask: the owner switched notifications on (or just signed in): asks for permission once and
 * registers this phone; throws PushSyncError if the server can't be reached, changing nothing.
 * Without ask (each app start): tells the server the saved choice again, so a change left half
 * done is put right. Quietly does nothing in a simulator or before the app has an EAS project id.
 */
export async function registerForPush(ask = false): Promise<PushState> {
  const id = projectId();
  if (!Device.isDevice || !id) return "unavailable";
  if (ask) {
    const result = await pushSwitch.turnOn(() => tokenFor(id, true));
    return result === "on" ? "on" : permission();
  }
  const result = await pushSwitch.resume(() => tokenFor(id, false));
  return result === "on" ? "on" : (await permission()) === "blocked" ? "blocked" : "off";
}

/**
 * A guest following a conversation: asks once for permission, then tells the server to
 * push this phone when the owner answers. Quietly does nothing where pushes can't work.
 */
export async function registerGuestPush(conversation: string): Promise<PushState> {
  const id = projectId();
  if (!Device.isDevice || !id) return "unavailable";
  await ensureChannel();
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && canAskAgain) ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return canAskAgain ? "off" : "blocked";
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  await guestApi.setPush(conversation, token);
  return "on";
}

/** Where a tapped notification should open. */
export function routeFor(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if ((data.type === "message" || data.type === "request") && typeof data.conversation === "number")
    return `/thread/${data.conversation}`;
  if (data.type === "booking") return "/calendar";
  if (data.type === "guest-message" && typeof data.token === "string") return `/chat/${data.token}`;
  if (data.type === "monitor" && typeof data.id === "number") return `/monitor/${data.id}`;
  if (data.type === "review" && typeof data.cottage === "number") return `/listing/${data.cottage}/reviews`;
  return null;
}
