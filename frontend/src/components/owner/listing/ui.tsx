"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./editor.module.css";

/** A modal built on <dialog>: focus stays inside, Escape closes, the page behind is inert. */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={s.dialog} aria-label={title} onClose={onClose} onCancel={onClose}>
      {open ? (
        <div className={s.dialogBody}>
          <h2>{title}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export type Toast = { id: number; kind: "ok" | "error"; text: string };

/** Short notices that read themselves out to screen readers and leave after a few seconds. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);
  const view = (
    <div className={s.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <p key={t.id} className={s.toast} data-kind={t.kind}>
          {t.text}
        </p>
      ))}
    </div>
  );
  return { push, view };
}

export function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

const arrow = (d: string) =>
  function Arrow() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    );
  };
export const ArrowUp = arrow("M12 19V5M5 12l7-7 7 7");
export const ArrowDown = arrow("M12 5v14M5 12l7 7 7-7");
export const ArrowLeft = arrow("M19 12H5M12 19l-7-7 7-7");
export const ArrowRight = arrow("M5 12h14M12 5l7 7-7 7");
export const Trash = arrow("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3");

/** The error message DRF sent for a field, or nothing. Nested errors (lists) count too. */
export function fieldError(errors: Record<string, unknown>, key: string): string | undefined {
  const e = errors[key];
  if (!e) return undefined;
  if (Array.isArray(e)) return e.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  return typeof e === "string" ? e : JSON.stringify(e);
}
