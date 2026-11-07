"use client";
// The prices in the browser (owner pages, sign-up welcome): asked once per page load and shared.
// The app has its own version of this file (mobile/src/lib/usePrices.ts) that asks through its API.
import { useEffect, useState } from "react";
import { DEFAULT_PRICES, fromApi, type Prices } from "./prices";

let asked: Promise<Prices> | null = null;

export function usePrices(initial: Prices = DEFAULT_PRICES): Prices {
  const [prices, setPrices] = useState(initial);
  useEffect(() => {
    asked ??= fetch("/api/pricing/", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(fromApi)
      .catch(() => DEFAULT_PRICES);
    let live = true;
    asked.then((p) => live && setPrices(p));
    return () => {
      live = false;
    };
  }, []);
  return prices;
}
