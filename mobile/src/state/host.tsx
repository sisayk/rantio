// The owner's figures, shared by the hosting tabs: this year's summary (Today and
// Earnings) and the inbox (its badge). Refreshed when the app comes back to the front.
// Everything is tagged with the sign-in it belongs to and shown only for that one.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import { type ConversationRow, ownerApi, type Summary } from "@/api";
import { useSession } from "@/state/session";

type Host = {
  summary: Summary | null;
  conversations: ConversationRow[] | null;
  unread: number;
  error: unknown;
  loading: boolean;
  year: number | null;
  setYear: (y: number) => void;
  /** Reloads the summary and the inbox; `loading` is true meanwhile (pull to refresh). */
  refresh: () => Promise<void>;
  refreshInbox: () => Promise<void>;
};

type Data = { session: string | null; summary: Summary | null; conversations: ConversationRow[] | null; error: unknown };

const EMPTY: Data = { session: null, summary: null, conversations: null, error: null };
const Ctx = createContext<Host | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
  const { sessionId: signedInAs, owner } = useSession();
  // Hosting figures are for hosts; someone signed in who hasn't listed yet has none to load.
  const sessionId = owner?.is_host ? signedInAs : null;
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const refreshInbox = useCallback(async () => {
    if (!sessionId) return;
    const r = await ownerApi.conversations();
    setData((d) => ({ ...(d.session === sessionId ? d : { ...EMPTY, session: sessionId }), conversations: r.results }));
  }, [sessionId]);

  const fetchAll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [summary, inbox] = await Promise.all([ownerApi.summary(year ?? undefined), ownerApi.conversations()]);
      setData({ session: sessionId, summary, conversations: inbox.results, error: null });
    } catch (error) {
      setData((d) => ({ ...(d.session === sessionId ? d : { ...EMPTY, session: sessionId }), error }));
    }
  }, [sessionId, year]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void fetchAll();
    });
    return () => sub.remove();
  }, [fetchAll]);

  const value = useMemo<Host>(() => {
    const d = sessionId && data.session === sessionId ? data : EMPTY;
    const conversations = d.conversations;
    return {
      summary: d.summary,
      conversations,
      unread: (conversations ?? []).filter((c) => c.unread && !c.archived).length,
      error: d.error,
      loading,
      year,
      setYear,
      refresh,
      refreshInbox,
    };
  }, [data, sessionId, loading, year, refresh, refreshInbox]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useHost(): Host {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHost outside HostProvider");
  return v;
}
