"use client";

import "react-day-picker/style.css";
import { useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { da, de, enIE, et, fi, is, lt, lv, nb, nn, sv } from "react-day-picker/locale";
import type { Messages } from "@/i18n";
import { fill, type Plural, plural } from "@/i18n/format";
import { type Currency, currencySign, formatPrice } from "@/lib/currency";
import type { Lang } from "@/i18n/locales";
import styles from "./guest.module.css";

export type Guests = { adults: number; children: number };

// Month and weekday names for the calendar; weeks start on Monday everywhere we work.
export const CALENDAR_LOCALES = { en: enIE, fi, sv, nb, nn, da, is, et, lv, lt, de } as const;

/** A number with − and + buttons, as in the guest picker. */
export function Stepper({
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
  t,
  value,
  onApply,
}: {
  t: Messages["guest"]["guestPicker"];
  value: Guests;
  onApply: (g: Guests) => void;
}) {
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
  t,
  nights: nightsWord,
  value,
  today,
  onChange,
  onDone,
}: {
  lang: Lang;
  t: Messages["guest"]["datePicker"];
  nights: Plural;
  value: DateRange | undefined;
  today: Date;
  onChange: (r: DateRange | undefined) => void;
  onDone: () => void;
}) {
  // The panel only opens after a click, so the window size is known here.
  const [months] = useState(() => (window.innerWidth < 720 ? 1 : 2));
  const nights =
    value?.from && value?.to ? Math.round((value.to.getTime() - value.from.getTime()) / 86_400_000) : 0;
  return (
    <div className={styles.datePanel} role="dialog" aria-label={t.title}>
      <DayPicker
        mode="range"
        locale={CALENDAR_LOCALES[lang]}
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
        <span className={styles.nights}>{nights ? plural(lang, nightsWord, nights) : t.hint}</span>
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

export type PriceRange = { min: number; max: number }; // 0 = no limit

/** A round number at the slider's top: 1 000 €, 10 000 kr, 150 000 kr. */
function niceTop(n: number) {
  const unit = 10 ** Math.max(1, Math.floor(Math.log10(n)) - 1);
  return Math.ceil(n / unit) * unit;
}

/**
 * Price per night as a range: a two-handle slider over how the cottages' prices are spread,
 * and boxes for exact amounts. The slider runs on a square-root scale, so the common
 * 80–300 € range gets room while the top still reaches villas at 1 000 €+; typed amounts
 * have no ceiling at all. Amounts are in the visitor's currency; `floor` is the lowest top
 * of the scale in it (about 1 000 €).
 */
export function PricePanel({
  lang,
  t,
  clear,
  use,
  prices,
  value,
  count,
  onApply,
  currency,
  floor,
}: {
  lang: Lang;
  currency: Currency;
  floor: number;
  t: Messages["guest"]["filters"];
  clear: string;
  use: (n: number) => string;
  prices: number[];
  value: PriceRange;
  count: (r: PriceRange) => number;
  onApply: (r: PriceRange) => void;
}) {
  const top = niceTop(Math.max(floor, ...prices));
  const step = 10 ** Math.max(0, Math.floor(Math.log10(top)) - 2); // 10 € steps up to 1 000 €
  const toPrice = (pos: number) => (pos >= 100 ? 0 : Math.round((top * (pos / 100) ** 2) / step) * step);
  const toPos = (price: number, end: "min" | "max") =>
    price <= 0 ? (end === "min" ? 0 : 100) : Math.min(100, Math.round(100 * Math.sqrt(price / top)));
  const [draft, setDraft] = useState<PriceRange>(value);
  const lo = toPos(draft.min, "min");
  const hi = toPos(draft.max, "max");
  const eur = (n: number) => formatPrice(lang, n, currency);
  const sign = currencySign(lang, currency);

  // A small histogram of where the cottages' prices fall on the slider.
  const BINS = 28;
  const bins = Array.from({ length: BINS }, () => 0);
  for (const p of prices) bins[Math.min(BINS - 1, Math.floor((toPos(p, "min") / 100) * BINS))] += 1;
  const tallest = Math.max(1, ...bins);

  const setLo = (pos: number) => setDraft((d) => ({ ...d, min: Math.min(pos, hi - 2) <= 0 ? 0 : toPrice(Math.min(pos, hi - 2)) }));
  const setHi = (pos: number) => setDraft((d) => ({ ...d, max: toPrice(Math.max(pos, lo + 2)) }));
  const typed = (s: string) => {
    const n = Math.floor(Number(s.replace(/[^\d]/g, "")));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const invalid = draft.min > 0 && draft.max > 0 && draft.min > draft.max;

  return (
    <div className={styles.pricePanel} role="dialog" aria-label={t.priceTitle}>
      <p className={styles.priceTitle}>{t.priceTitle}</p>
      <div className={styles.histogram} aria-hidden="true">
        {bins.map((n, i) => {
          const inside = (i + 0.5) * (100 / BINS) >= lo && (i + 0.5) * (100 / BINS) <= hi;
          return <span key={i} data-inside={inside} style={{ height: n ? `${12 + (88 * n) / tallest}%` : 0 }} />;
        })}
      </div>
      <div className={styles.dualRange} style={{ "--lo": lo, "--hi": hi } as React.CSSProperties}>
        <input
          type="range"
          min={0}
          max={100}
          value={lo}
          aria-label={t.priceMin}
          aria-valuetext={draft.min ? eur(draft.min) : eur(0)}
          onChange={(e) => setLo(Number(e.target.value))}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={hi}
          aria-label={t.priceMax}
          aria-valuetext={draft.max ? eur(draft.max) : fill(lang, t.priceAndUp, { price: eur(top) })}
          onChange={(e) => setHi(Number(e.target.value))}
        />
      </div>
      <div className={styles.priceScale} aria-hidden="true">
        <span>{eur(0)}</span>
        <span>{fill(lang, t.priceAndUp, { price: eur(top) })}</span>
      </div>
      <div className={styles.priceBoxes}>
        <label>
          {t.priceMin}
          <span>
            <input
              inputMode="numeric"
              value={draft.min || ""}
              placeholder="0"
              onChange={(e) => setDraft({ ...draft, min: typed(e.target.value) })}
            />
            {sign}
          </span>
        </label>
        <span className={styles.priceDash} aria-hidden="true">–</span>
        <label>
          {t.priceMax}
          <span>
            <input
              inputMode="numeric"
              value={draft.max || ""}
              placeholder={`${top}+`}
              onChange={(e) => setDraft({ ...draft, max: typed(e.target.value) })}
            />
            {sign}
          </span>
        </label>
      </div>
      <div className={styles.panelFooter}>
        <button type="button" className={styles.textButton} onClick={() => onApply({ min: 0, max: 0 })}>
          {clear}
        </button>
        <button
          type="button"
          className={styles.applyButton}
          disabled={invalid}
          onClick={() => onApply(draft)}
        >
          {use(invalid ? 0 : count(draft))}
        </button>
      </div>
    </div>
  );
}

/** "€100 – €400", "From €400", "Up to €200" or just "Price". */
export function priceLabel(lang: Lang, t: Messages["guest"]["filters"], r: PriceRange, currency: Currency = "EUR") {
  const eur = (n: number) => formatPrice(lang, n, currency);
  if (r.min && r.max) return fill(lang, t.priceRange, { min: eur(r.min), max: eur(r.max) });
  if (r.min) return fill(lang, t.priceFrom, { price: eur(r.min) });
  if (r.max) return fill(lang, t.upTo, { price: eur(r.max) });
  return t.price;
}
