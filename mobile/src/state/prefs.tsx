// What the app remembers on this phone: language, currency, travelling or hosting,
// saved cottages and the guest's own conversations (their private tokens).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Lang } from "@/i18n/locales";
import { type Currency, FALLBACK_RATES, isCurrency, LANG_CURRENCY, type Rates } from "@/lib/currency";

export type Mode = "travelling" | "hosting";

/** A conversation the guest started from this phone. */
export type GuestChat = { token: string; listing: string; at: string; kind: "enquiry" | "request" };

type Stored = {
  lang: Lang | null;
  currency: Currency | null;
  mode: Mode;
  saved: string[];
  chats: GuestChat[];
  rates?: { at: number; rates: Rates };
};

type Prefs = {
  ready: boolean;
  lang: Lang;
  currency: Currency;
  mode: Mode;
  saved: string[];
  chats: GuestChat[];
  rates: Rates;
  ratesAt: number;
  setLang: (l: Lang) => void;
  setCurrency: (c: Currency) => void;
  setMode: (m: Mode) => void;
  toggleSaved: (id: string) => void;
  addChat: (c: GuestChat) => void;
  setRates: (r: Rates) => void;
};

const KEY = "stugora:prefs:v1";
const RATES_MAX_AGE = 12 * 60 * 60 * 1000;
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ deviceLang, children }: { deviceLang: Lang; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [s, setS] = useState<Stored>({ lang: null, currency: null, mode: "travelling", saved: [], chats: [] });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw) as Partial<Stored>;
        setS((cur) => ({
          ...cur,
          ...v,
          currency: isCurrency(v.currency) ? v.currency : null,
          saved: Array.isArray(v.saved) ? v.saved : [],
          chats: Array.isArray(v.chats) ? v.chats : [],
        }));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);
  }, [s, ready]);

  const update = useCallback((patch: (cur: Stored) => Partial<Stored>) => setS((cur) => ({ ...cur, ...patch(cur) })), []);

  const value = useMemo<Prefs>(() => {
    const lang = s.lang ?? deviceLang;
    return {
      ready,
      lang,
      currency: s.currency ?? LANG_CURRENCY[lang],
      mode: s.mode,
      saved: s.saved,
      chats: s.chats,
      rates: { ...FALLBACK_RATES, ...(s.rates?.rates ?? {}) },
      ratesAt: s.rates?.at ?? 0,
      setLang: (l) => update(() => ({ lang: l })),
      setCurrency: (c) => update(() => ({ currency: c })),
      setMode: (m) => update(() => ({ mode: m })),
      toggleSaved: (id) =>
        update((cur) => ({ saved: cur.saved.includes(id) ? cur.saved.filter((x) => x !== id) : [id, ...cur.saved] })),
      addChat: (c) => update((cur) => ({ chats: [c, ...cur.chats.filter((x) => x.token !== c.token)] })),
      setRates: (r) => update(() => ({ rates: { at: Date.now(), rates: { ...FALLBACK_RATES, ...r, EUR: 1 } } })),
    };
  }, [s, ready, deviceLang, update]);

  return <Ctx value={value}>{children}</Ctx>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs outside PrefsProvider");
  return v;
}

/** Whether the stored rates are older than half a day and should be fetched again. */
export const ratesStale = (at: number) => Date.now() - at > RATES_MAX_AGE;
