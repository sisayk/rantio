"use client";

import { useId, useState } from "react";
import { content, type Lang, ownerNetGain } from "@/lib/content";
import styles from "./landing.module.css";

export default function Estimator({ lang }: { lang: Lang }) {
  const t = content[lang];
  const [nights, setNights] = useState(20);
  const [price, setPrice] = useState(150);
  const sliderId = useId();
  const priceId = useId();

  const gain = Math.round(ownerNetGain(nights, price) / 10) * 10;
  const euros = new Intl.NumberFormat(t.locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(gain);
  const fill = ((nights - 5) / (60 - 5)) * 100;

  return (
    <div className={styles.estimator}>
      <h1 className={styles.heroTitle}>
        {t.hero.before} <span className={styles.heroAmount}>{euros}</span> {t.hero.after}
      </h1>

      <p className={styles.heroMeta} aria-live="polite">
        {t.hero.nights(nights)}, {price} {t.hero.perNight}
      </p>

      <label htmlFor={sliderId} className={styles.visuallyHidden}>
        {t.hero.nightsLabel}
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
        <label htmlFor={priceId}>{t.hero.priceLabel}</label>
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
          <span aria-hidden="true">{t.hero.perNight}</span>
        </span>
      </div>

      <p className={styles.finePrint}>{t.hero.finePrint}</p>
    </div>
  );
}
