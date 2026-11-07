// The app's version of frontend/src/lib/usePrices.ts ("@/lib/…" looks in mobile/src first): Rantio's
// prices as set in the admin, asked once per app start through the app's API client and shared.
import { useEffect, useState } from "react";
import { guestApi } from "@/api";
import { DEFAULT_PRICES, fromApi, type Prices } from "@/lib/prices";

let asked: Promise<Prices> | null = null;

export function usePrices(initial: Prices = DEFAULT_PRICES): Prices {
  const [prices, setPrices] = useState(initial);
  useEffect(() => {
    asked ??= guestApi.pricing().then(fromApi, () => {
      asked = null; // ask again next time; keep the starting prices meanwhile
      return DEFAULT_PRICES;
    });
    let live = true;
    asked.then((p) => live && setPrices(p));
    return () => {
      live = false;
    };
  }, []);
  return prices;
}
