// Who answers a cottage page's messages (GET /api/cottages/<slug>/contact/): the owner, or the Rantio team
// for an example stay with no owner on Rantio yet. Until it's known, and offline, the app speaks as for an
// example stay, which never promises an owner who isn't there (as the website does: lib/answeredBy.ts).
import { useEffect, useState } from "react";

import { guestApi } from "@/api";
import type { AnsweredBy } from "@/lib/answeredBy";

const asked = new Map<string, Promise<AnsweredBy>>();

function load(slug: string): Promise<AnsweredBy> {
  let p = asked.get(slug);
  if (!p) {
    p = guestApi
      .contact(slug)
      .then((v): AnsweredBy => (v.answered_by === "owner" ? "owner" : "rantio"))
      .catch((): AnsweredBy => {
        asked.delete(slug); // offline: ask again next time
        return "rantio";
      });
    asked.set(slug, p);
  }
  return p;
}

export function useAnsweredBy(slug: string | undefined): AnsweredBy {
  const [who, setWho] = useState<AnsweredBy>("rantio");
  useEffect(() => {
    if (!slug) return;
    let live = true;
    load(slug).then((w) => live && setWho(w));
    return () => {
      live = false;
    };
  }, [slug]);
  return who;
}
