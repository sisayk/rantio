"use client";

import "react-day-picker/style.css";
import { useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { enGB, fi } from "react-day-picker/locale";
import type { Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import styles from "./guest.module.css";

export type Guests = { adults: number; children: number };

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  less,
  more,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  less: string;
  more: string;
}) {
  return (
    <div className={styles.stepRow}>
      <span className={styles.stepLabel}>{label}</span>
      <div className={styles.stepper}>
        <button type="button" aria-label={`${less}: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <output aria-live="polite" aria-label={label}>
          {value}
        </output>
        <button type="button" aria-label={`${more}: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Adults and children, applied with "Use" so half-made changes don't filter the list. */
export function GuestPanel({
  lang,
  value,
  onApply,
}: {
  lang: Lang;
  value: Guests;
  onApply: (g: Guests) => void;
}) {
  const t = guestContent[lang].guestPicker;
  const [draft, setDraft] = useState<Guests>(value.adults ? value : { adults: 1, children: 0 });
  return (
    <div className={styles.guestPanel} role="dialog" aria-label={t.title}>
      <Stepper
        label={t.adults}
        value={draft.adults}
        min={1}
        max={16}
        less={t.less}
        more={t.more}
        onChange={(adults) => setDraft({ ...draft, adults })}
      />
      <Stepper
        label={t.children}
        value={draft.children}
        min={0}
        max={10}
        less={t.less}
        more={t.more}
        onChange={(children) => setDraft({ ...draft, children })}
      />
      <div className={styles.panelFooter}>
        <button type="button" className={styles.textButton} onClick={() => onApply({ adults: 0, children: 0 })}>
          {t.clear}
        </button>
        <button type="button" className={styles.applyButton} onClick={() => onApply(draft)}>
          {t.use}
        </button>
      </div>
    </div>
  );
}

/** Check-in and check-out on a two-month calendar. */
export function DatePanel({
  lang,
  value,
  today,
  onChange,
  onDone,
}: {
  lang: Lang;
  value: DateRange | undefined;
  today: Date;
  onChange: (r: DateRange | undefined) => void;
  onDone: () => void;
}) {
  const t = guestContent[lang].datePicker;
  // The panel only opens after a click, so the window size is known here.
  const [months] = useState(() => (window.innerWidth < 720 ? 1 : 2));
  const nights =
    value?.from && value?.to ? Math.round((value.to.getTime() - value.from.getTime()) / 86_400_000) : 0;
  return (
    <div className={styles.datePanel} role="dialog" aria-label={t.title}>
      <DayPicker
        mode="range"
        locale={lang === "fi" ? fi : enGB}
        numberOfMonths={months}
        pagedNavigation
        weekStartsOn={1}
        min={1}
        disabled={{ before: today }}
        startMonth={today}
        defaultMonth={value?.from ?? today}
        selected={value}
        onSelect={onChange}
        className={styles.dayPicker}
      />
      <div className={styles.panelFooter}>
        <span className={styles.nights}>{nights ? t.nights(nights) : t.hint}</span>
        <button type="button" className={styles.textButton} onClick={() => onChange(undefined)}>
          {t.clear}
        </button>
        <button type="button" className={styles.applyButton} onClick={onDone}>
          {t.done}
        </button>
      </div>
    </div>
  );
}
