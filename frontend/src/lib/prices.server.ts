import { cacheLife } from "next/cache";
import { DEFAULT_PRICES, fromApi, type Prices } from "./prices";

const API_URL = process.env.API_URL ?? "http://localhost:8100";

/** The prices for server-rendered pages; asked again at most once a minute, so a change in the
 *  admin is on the site within about a minute. If Django can't be reached, the starting prices. */
export async function getPrices(): Promise<Prices> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 86400 });
  try {
    const res = await fetch(`${API_URL}/api/pricing/`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
    return res.ok ? fromApi(await res.json()) : DEFAULT_PRICES;
  } catch {
    return DEFAULT_PRICES;
  }
}
