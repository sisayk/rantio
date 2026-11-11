import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/hanken-grotesk";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform, Settings, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { HostProvider } from "@/state/host";
import { PrefsProvider, usePrefs } from "@/state/prefs";
import { routeFor } from "@/state/push";
import { SessionProvider, useSession } from "@/state/session";
import { deviceLang } from "@/text/i18n";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Opens the conversation or calendar a tapped notification is about. */
function useNotificationTaps() {
  const router = useRouter();
  const { signedIn } = useSession();
  useEffect(() => {
    if (!signedIn) return;
    const open = (n: Notifications.Notification) => {
      const href = routeFor(n.request.content.data as Record<string, unknown>);
      if (href) router.push(href as never);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          open(r.notification);
          Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, [signedIn, router]);
}

/** Screenshots (scripts/site-shots.sh): a launch with  -RantioOpen /map  opens that screen, without the
 *  "Open in Rantio?" prompt iOS puts in front of a link. Launch arguments only exist for that launch. */
function useLaunchRoute(ready: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!ready || Platform.OS !== "ios") return;
    const route = Settings.get("RantioOpen");
    if (typeof route !== "string" || !/^\/[a-z-]+$/.test(route)) return;
    const timer = setTimeout(() => router.navigate(route as never), 300);
    return () => clearTimeout(timer);
  }, [ready, router]);
}

function Root() {
  const prefs = usePrefs();
  const session = useSession();
  const [fontsLoaded] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_800ExtraBold });
  const ready = prefs.ready && session.ready && fontsLoaded;
  useNotificationTaps();
  useLaunchRoute(ready);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="(guest)" options={{ animation: "fade" }} />
        <Stack.Screen name="(host)" options={{ animation: "fade" }} />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="list-cottage" options={{ presentation: "modal" }} />
        <Stack.Screen name="contact/[id]" options={{ presentation: "modal" }} />
        {/* Full sheets like the other pickers: in a detented form sheet iOS laid the list out over the title bar. */}
        <Stack.Screen name="language" options={{ presentation: "modal" }} />
        <Stack.Screen name="currency" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBarShield />
    </>
  );
}

/** Android draws every page under its see-through status bar, so scrolled content ran under the
 *  clock and signal icons. A strip in the page colour sits behind the icons on every screen. */
function StatusBarShield() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "android" || !insets.top) return null;
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.page }} />;
}

export default function Layout() {
  const lang = useMemo(() => deviceLang(), []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider deviceLang={lang}>
          <SessionProvider>
            <HostProvider>
              <Root />
            </HostProvider>
          </SessionProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
