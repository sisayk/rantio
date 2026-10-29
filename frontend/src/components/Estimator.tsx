"use client";

import { useId, useState } from "react";
import type { Messages } from "@/i18n";
import { money, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { ownerNetGain } from "@/lib/content";
import styles from "./landing.module.css";

export default function Estimator({ lang, t }: { lang: Lang; t: Messages["owner"]["hero"] }) {
  const [nights, setNights] = useState(20);
  const [price, setPrice] = useState(150);
  const sliderId = useId();
  const priceId = useId();

  const gain = Math.round(ownerNetGain(nights, price) / 10) * 10;
  const euros = money(lang, gain);
  // "Your cottage could earn {amount} more a year": the amount sits wherever the language puts it.
  const [before, after = ""] = t.title.split("{amount}");
  const fill = ((nights - 5) / (60 - 5)) * 100;

  return (
    <div className={styles.estimator}>
      <h1 className={styles.heroTitle}>
        {before}
        <span className={styles.heroAmount}>{euros}</span>
        {after}
      </h1>

      <p className={styles.heroMeta} aria-live="polite">
        {plural(lang, t.nights, nights)}, {price} {t.perNight}
      </p>

      <label htmlFor={sliderId} className={styles.visuallyHidden}>
        {t.nightsLabel}
      </label>
      <input
        id={sliderId}
        className={styles.slider}
        type="range"
        min={5}
        max={60}
        step={1}
        value={nights}
        onChange={(e) => setNights(Number(e.target.value))}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />

      <div className={styles.pricePill}>
        <label htmlFor={priceId}>{t.priceLabel}</label>
        <span className={styles.priceInputWrap}>
          <input
            id={priceId}
            type="number"
            inputMode="numeric"
            min={40}
            max={1000}
            step={10}
            value={price}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) setPrice(Math.min(1000, Math.max(0, value)));
            }}
          />
          <span aria-hidden="true">{t.perNight}</span>
        </span>
      </div>

      <p className={styles.finePrint}>{t.finePrint}</p>
    </div>
  );
}
