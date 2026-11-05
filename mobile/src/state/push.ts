// Push notifications. Owners: new bookings, guest messages and booking requests. Guests:
// the owner's answer in a conversation they follow in the app. The server sends them
// through Expo's push service to the token we register here.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { guestApi, ownerApi } from "@/api";

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

export async function pushState(): Promise<PushState> {
  if (!Device.isDevice || !projectId()) return "unavailable";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "on";
  return canAskAgain ? "off" : "blocked";
}

/**
 * Asks once (the system shows its own prompt) and tells the server where to push.
 * Quietly does nothing in a simulator or before the app has an EAS project id.
 */
export async function registerForPush(ask = false): Promise<PushState> {
  const id = projectId();
  if (!Device.isDevice || !id) return "unavailable";
  await ensureChannel();
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask && canAskAgain) ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return canAskAgain ? "off" : "blocked";
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  await ownerApi.setPushToken(token);
  return "on";
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
  return null;
}
