"use client";
// Who answers a cottage page's messages (GET /api/cottages/<slug>/contact/): the owner, or the Rantio team
// for an example stay with no owner on Rantio yet. Until it's known, and if it can't be asked, the page
// speaks as for an example stay: that never promises an owner who isn't there. The emails always say
// the right one, whatever the page showed (backend owners/messaging.py).
import { useEffect, useState } from "react";

export type AnsweredBy = "owner" | "rantio";

const asked = new Map<string, Promise<AnsweredBy>>();

function load(slug: string): Promise<AnsweredBy> {
  let p = asked.get(slug);
  if (!p) {
    p = fetch(`/api/cottages/${encodeURIComponent(slug)}/contact/`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { answered_by?: string } | null): AnsweredBy => (v?.answered_by === "owner" ? "owner" : "rantio"))
      .catch((): AnsweredBy => "rantio");
    asked.set(slug, p);
  }
  return p;
}

export function useAnsweredBy(slug: string): AnsweredBy {
  const [who, setWho] = useState<AnsweredBy>("rantio");
  useEffect(() => {
    let live = true;
    load(slug).then((w) => live && setWho(w));
    return () => {
      live = false;
    };
  }, [slug]);
  return who;
}

/** A thread from before the API said who answers: the owner if it names one. */
export const threadAnsweredBy = (th: { answered_by?: AnsweredBy; host_name: string }): AnsweredBy =>
  th.answered_by ?? (th.host_name ? "owner" : "rantio");
