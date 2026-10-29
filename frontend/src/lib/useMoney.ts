"use client";
// The visitor's currency (remembered in this browser) and the day's exchange rates,
// shared by every price on the page. The server renders the language's own currency
// with the fallback rates; the browser then switches to the visitor's choice.
import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "@/i18n/locales";
import {
  convert,
  type Currency,
  FALLBACK_RATES,
  formatPrice,
  isCurrency,
  LANG_CURRENCY,
  type Rates,
  roundNicely,
} from "./currency";

const KEY = "stugora:currency";
const RATES_KEY = "stugora:rates";
const RATES_MAX_AGE = 12 * 60 * 60 * 1000;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  loadRates();
  return () => listeners.delete(l);
};

function readChoice(): Currency | null {
  try {
    const v = localStorage.getItem(KEY);
    return isCurrency(v) ? v : null;
  } catch {
    return null;
  }
}

export function setCurrencyChoice(c: Currency) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    // private mode: the choice lasts for this page only
  }
  choice = c;
  notify();
}

let choice: Currency | null | undefined;
let rates: Rates = FALLBACK_RATES;
let ratesLoaded = false;

function loadRates() {
  if (ratesLoaded || typeof window === "undefined") return;
  ratesLoaded = true;
  try {
    const cached = JSON.parse(localStorage.getItem(RATES_KEY) ?? "null") as { at: number; rates: Rates } | null;
    if (cached && Date.now() - cached.at < RATES_MAX_AGE) {
      rates = { ...FALLBACK_RATES, ...cached.rates };
      notify();
      return;
    }
  } catch {
    // unreadable cache: fetch again
  }
  fetch("/api/rates/")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((body: { rates: Partial<Rates> }) => {
      rates = { ...FALLBACK_RATES, ...body.rates, EUR: 1 };
      try {
        localStorage.setItem(RATES_KEY, JSON.stringify({ at: Date.now(), rates }));
      } catch {
        // storage full or blocked: rates are fetched again next time
      }
      notify();
    })
    .catch(() => undefined); // the fallback rates stay
}

const getChoice = () => {
  if (choice === undefined) choice = readChoice();
  return choice;
};
const getRates = () => rates;

/** Prices in the visitor's currency: `price(1450, "SEK")` → "about 130 €" on a Finnish page. */
export function useMoney(lang: Lang) {
  const picked = useSyncExternalStore(subscribe, getChoice, () => null);
  const r = useSyncExternalStore(subscribe, getRates, () => FALLBACK_RATES);
  const currency: Currency = picked ?? LANG_CURRENCY[lang];

  /** An amount in the visitor's currency, rounded the way people quote prices. */
  const toViewer = useCallback(
    (amount: number, from: Currency) =>
      from === currency ? amount : roundNicely(convert(amount, from, currency, r), currency),
    [currency, r],
  );
  const format = useCallback((amount: number, c: Currency = currency) => formatPrice(lang, amount, c), [lang, currency]);
  /** A cottage's price as the visitor sees it, and whether it was converted (shown as "about"). */
  const show = useCallback(
    (amount: number, from: Currency) => ({ text: format(toViewer(amount, from)), converted: from !== currency }),
    [format, toViewer, currency],
  );
  /** Amounts in euros, for comparing prices across currencies (sorting, the price filter). */
  const toEur = useCallback((amount: number, from: Currency) => convert(amount, from, "EUR", r), [r]);
  const fromEur = useCallback((amount: number) => convert(amount, "EUR", currency, r), [currency, r]);

  return { currency, rates: r, toViewer, format, show, toEur, fromEur, setCurrency: setCurrencyChoice };
}
