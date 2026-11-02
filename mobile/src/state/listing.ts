// One listing in the app's editor: loaded when a screen comes into view, saved field by
// field through the same API as Hosting → My listings on the website.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ApiError, type ListingDetail, type ListingFields, Offline, ownerApi } from "@/api";

export type FieldErrors = Record<string, string>;

/** DRF's field errors ({"price_per_night": ["…"]}) as one message per field. */
export function fieldErrors(e: unknown): FieldErrors {
  if (!(e instanceof ApiError)) return {};
  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(e.body)) {
    if (Array.isArray(v) && typeof v[0] === "string") out[k] = v[0];
    else if (typeof v === "string" && k !== "detail") out[k] = v;
  }
  return out;
}

export function useListing(id: number) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [failed, setFailed] = useState<"offline" | "missing" | null>(null);

  const load = useCallback(async () => {
    try {
      setListing(await ownerApi.listing(id));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 404 ? "missing" : e instanceof Offline ? "offline" : "offline");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Saves some fields; the listing comes back as the server now has it. Throws with field errors. */
  const save = useCallback(
    async (fields: Partial<ListingFields>) => {
      const next = await ownerApi.saveListing(id, fields);
      setListing(next);
      return next;
    },
    [id],
  );

  return { listing, setListing, failed, load, save };
}

/**
 * One editor screen: the listing, the screen's own form (made from the listing until the owner
 * changes something), field errors, and saving only what changed.
 */
export function useEditor<D extends object>(id: number, from: (l: ListingDetail) => D, toFields: (d: D) => Partial<ListingFields>) {
  const { listing, failed, load, save } = useListing(id);
  const [draft, setDraft] = useState<D | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<"invalid" | "network" | null>(null);
  const base = listing ? from(listing) : null;
  const form = draft ?? base;
  const dirty = draft != null && base != null && JSON.stringify(draft) !== JSON.stringify(base);

  const set = <K extends keyof D>(key: K, value: D[K]) => {
    if (!base) return;
    setDraft((d) => ({ ...(d ?? base), [key]: value }));
  };

  const submit = async () => {
    if (!draft || !base) return;
    const fields = changed(toFields(draft), toFields(base));
    setSaving(true);
    setProblem(null);
    try {
      if (Object.keys(fields).length) await save(fields);
      setDraft(null);
      setErrors({});
    } catch (e) {
      const found = fieldErrors(e);
      setErrors(found);
      setProblem(e instanceof ApiError && Object.keys(found).length ? "invalid" : "network");
    } finally {
      setSaving(false);
    }
  };

  return { listing, failed, load, form, set, dirty, saving, errors, problem, submit };
}

/** A number field's text for the server: "" → null, "12,5" → 12.5; anything else is sent as typed so the server names the field. */
export function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return (Number.isFinite(n) ? n : t) as number;
}
export const numText = (v: number | null | undefined) => (v == null ? "" : String(v));

/** The fields a screen edits, as text for the inputs, and whether they differ from the listing. */
export function changed<T extends object>(draft: T, saved: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(draft) as (keyof T)[]) {
    if (JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) out[k] = draft[k];
  }
  return out;
}
