"use client";
// The real ratings and host of a cottage page (GET /api/cottages/<slug>/about/), asked once per page
// and shared by the top of the page and the Ratings box. The example cottages have none (404): the
// page then shows "New on Rantio" and no host, never made-up reviews.
import { useEffect, useState } from "react";
import type { Ratings } from "@/lib/ownerApi";
import { NO_RATINGS } from "@/lib/ratingsPreview";

export type CottageHost = { name: string; photo: string | null; since: number };
export type CottageAbout = { ratings: Ratings; guestFavourite: boolean; host: CottageHost | null };

export const NOTHING_KNOWN: CottageAbout = { ratings: NO_RATINGS, guestFavourite: false, host: null };

const asked = new Map<string, Promise<CottageAbout>>();

function load(slug: string): Promise<CottageAbout> {
  let p = asked.get(slug);
  if (!p) {
    p = fetch(`/api/cottages/${encodeURIComponent(slug)}/about/`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { ratings: Ratings; guest_favourite: boolean; host: CottageHost | null } | null) =>
        v ? { ratings: v.ratings, guestFavourite: v.guest_favourite, host: v.host } : NOTHING_KNOWN,
      )
      .catch(() => NOTHING_KNOWN);
    asked.set(slug, p);
  }
  return p;
}

export function useCottageAbout(slug: string): CottageAbout {
  const [about, setAbout] = useState<CottageAbout>(NOTHING_KNOWN);
  useEffect(() => {
    let live = true;
    load(slug).then((a) => live && setAbout(a));
    return () => {
      live = false;
    };
  }, [slug]);
  return about;
}
