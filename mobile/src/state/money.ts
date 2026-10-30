// Prices in the traveller's currency, the way the website shows them: a cottage's own
// price stays exact, a converted one is rounded and marked "about".
import { useCallback, useEffect } from "react";

import { guestApi } from "@/api";
import { convert, type Currency, formatPrice, roundNicely } from "@/lib/currency";
import { ratesStale, usePrefs } from "@/state/prefs";

let asked = false; // once per app start; the fallback rates cover a failure

export function useMoney() {
  const { lang, currency, rates, ratesAt, setRates, setCurrency } = usePrefs();

  useEffect(() => {
    if (asked || !ratesStale(ratesAt)) return;
    asked = true;
    guestApi
      .rates()
      .then((r) => setRates(r.rates as Record<Currency, number>))
      .catch(() => undefined); // the fallback rates stay
  }, [ratesAt, setRates]);

  const toViewer = useCallback(
    (amount: number, from: Currency) => (from === currency ? amount : roundNicely(convert(amount, from, currency, rates), currency)),
    [currency, rates],
  );
  const format = useCallback((amount: number, c: Currency = currency, cents = false) => formatPrice(lang, amount, c, cents), [lang, currency]);
  const show = useCallback(
    (amount: number, from: Currency) => ({ text: format(toViewer(amount, from)), converted: from !== currency }),
    [format, toViewer, currency],
  );
  const toEur = useCallback((amount: number, from: Currency) => convert(amount, from, "EUR", rates), [rates]);
  const fromEur = useCallback((amount: number) => convert(amount, "EUR", currency, rates), [currency, rates]);

  return { currency, rates, toViewer, format, show, toEur, fromEur, setCurrency };
}
