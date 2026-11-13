// The owner's sign-in on this phone. The key lives in the phone's secure storage
// (Keychain / Keystore); the API ends it if it's no longer valid.
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Secure from "expo-secure-store";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { onApiSignedOut, type OwnerDetails, ownerApi, setApiKey, SignedOut, type SignInTo } from "@/api";
import { registerForPush } from "@/state/push";

const KEY = "stugora.ownerKey";
// A key whose sign-out didn't reach the server (no connection): ended there at the next start.
const PENDING = "stugora.ownerKeyToEnd";

// Keychain / Keystore on phones; the browser's storage only for the web preview used in development.
const SecureStore =
  Platform.OS === "web"
    ? {
        getItemAsync: (k: string) => AsyncStorage.getItem(k),
        setItemAsync: (k: string, v: string) => AsyncStorage.setItem(k, v),
        deleteItemAsync: (k: string) => AsyncStorage.removeItem(k),
      }
    : Secure;

/** Anyone signed in; is_host once they've listed a cottage (only hosts reach the hosting tabs). */
export type Owner = { name: string; email: string; language: string; is_pilot: boolean; is_host: boolean; phone?: string; photo?: string | null; details?: OwnerDetails };

type Session = {
  ready: boolean;
  signedIn: boolean;
  /** Changes with each sign-in, so data from an earlier owner on this phone is never shown. */
  sessionId: string | null;
  owner: Owner | null;
  /** Signs in (making an account for someone new) and says who it is. */
  signIn: (to: SignInTo, code: string) => Promise<Owner | null>;
  signInWith: (provider: "apple" | "google", idToken: string) => Promise<Owner | null>;
  /** Asks again who is signed in (after listing a cottage, the account is a host). */
  refresh: () => Promise<Owner | null>;
  /** Signed in by the sign-up form (its email was checked with a code). */
  signedUp: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Deletes the account on the server, then forgets it on this phone. */
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || Platform.OS;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);

  const keep = useCallback(async (token: string) => {
    await SecureStore.setItemAsync(KEY, token);
    setApiKey(token);
    setKey(token);
  }, []);

  const refresh = useCallback(async () => {
    const me = await ownerApi.me().catch(() => null);
    if (me) setOwner(me);
    return me;
  }, []);

  const forget = useCallback(async () => {
    setApiKey(null);
    setKey(null);
    setOwner(null);
    await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    onApiSignedOut(() => void forget());
    SecureStore.getItemAsync(PENDING)
      .then(async (old) => {
        if (!old) return;
        const ended = await ownerApi.logoutKey(old).then(() => true, (e) => e instanceof SignedOut);
        if (ended) await SecureStore.deleteItemAsync(PENDING);
      })
      .catch(() => undefined);
    SecureStore.getItemAsync(KEY)
      .then((k) => {
        if (k) {
          setApiKey(k);
          setKey(k);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [forget]);

  // Who is signed in (and a quiet check that the key still works).
  useEffect(() => {
    if (!key) return;
    ownerApi
      .me()
      .then((me) => {
        setOwner(me);
        registerForPush().catch(() => undefined);
      })
      .catch((e) => {
        if (e instanceof SignedOut) void forget();
      });
  }, [key, forget]);

  const value = useMemo<Session>(
    () => ({
      ready,
      signedIn: !!key,
      sessionId: key ? key.slice(-10) : null,
      owner,
      signIn: async (to, code) => {
        const { token } = await ownerApi.verifyCode(to, code, deviceName(), Platform.OS === "ios" ? "ios" : "android");
        await keep(token);
        return refresh();
      },
      signInWith: async (provider, idToken) => {
        const { token } = await ownerApi.social(provider, idToken, deviceName(), Platform.OS === "ios" ? "ios" : "android");
        await keep(token);
        return refresh();
      },
      refresh,
      signedUp: keep,
      signOut: async () => {
        const ending = key;
        const done = await ownerApi.logout().then(() => true, (e) => e instanceof SignedOut);
        // Not reached: the key (and its notifications) would stay alive on the server for months.
        if (!done && ending) await SecureStore.setItemAsync(PENDING, ending).catch(() => undefined);
        await forget();
      },
      deleteAccount: async () => {
        await ownerApi.deleteAccount();
        await forget();
      },
    }),
    [ready, key, owner, forget, keep, refresh],
  );

  return <Ctx value={value}>{children}</Ctx>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
