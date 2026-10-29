"use client";
// Whether this browser is signed in as a cottage owner, for the "Switch to hosting" /
// "Switch to traveling" links. Asked once per page load; remembered for the tab so the
// header doesn't change after it appears.
import { useSyncExternalStore } from "react";

export type OwnerSession = { name: string } | null; // null: not signed in

const KEY = "stugora:owner";
const listeners = new Set<() => void>();
let state: OwnerSession | undefined; // undefined: not known yet
let asked = false;
let loadedMemory = false;

function remembered(): OwnerSession | undefined {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === null ? undefined : (JSON.parse(v) as OwnerSession);
  } catch {
    return undefined;
  }
}

function set(next: OwnerSession) {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: asked again on the next page
  }
  listeners.forEach((l) => l());
}

function ask() {
  if (asked || typeof window === "undefined") return;
  asked = true;
  fetch("/api/owner/me/", { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((me: { name?: string } | null) => set(me?.name ? { name: me.name } : null))
    .catch(() => undefined);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  ask();
  return () => listeners.delete(l);
};

/** The signed-in owner, null when signed out, undefined until known (also on the server). */
function snapshot() {
  if (!loadedMemory) {
    loadedMemory = true;
    if (state === undefined) state = remembered();
  }
  return state;
}

export function useOwnerSession(): OwnerSession | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

/** After signing in or out on this tab. */
export function forgetOwnerSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing remembered
  }
  state = undefined;
  asked = false;
  loadedMemory = true;
}
