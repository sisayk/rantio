"use client";

import { useId, useState } from "react";
import type { Messages } from "@/i18n";
import { fill as fillIn, plural } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { NIGHT_PRICES } from "@/lib/content";
import { ownerNetGain, type Prices } from "@/lib/prices";
import { currencySign, formatPrice, LANG_CURRENCY, roundNicely } from "@/lib/currency";
import styles from "./landing.module.css";

export default function Estimator({ lang, t, prices }: { lang: Lang; t: Messages["owner"]["hero"]; prices: Prices }) {
  // In the page's currency: kronor on a Swedish page, with the Swedish yearly fee.
  const currency = LANG_CURRENCY[lang];
  const range = NIGHT_PRICES[currency];
  const [nights, setNights] = useState(20);
  const [price, setPrice] = useState(range.typical);
  const sliderId = useId();
  const priceId = useId();

  const gain = roundNicely(ownerNetGain(prices, nights, price, currency), currency);
  const amount = formatPrice(lang, gain, currency);
  const perNight = fillIn(lang, t.perNight, { currency: currencySign(lang, currency) });
  // "Your cottage could earn {amount} more a year": the amount sits wherever the language puts it.
  const [before, after = ""] = t.title.split("{amount}");
  const fill = ((nights - 5) / (60 - 5)) * 100;

  return (
    <div className={styles.estimator}>
      <h1 className={styles.heroTitle}>
        {before}
        <span className={styles.heroAmount}>{amount}</span>
        {after}
      </h1>

      <p className={styles.heroMeta} aria-live="polite">
        {plural(lang, t.nights, nights)}, {formatPrice(lang, price, currency)} / {perNight.split(" / ")[1] ?? ""}
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
            min={range.min}
            max={range.max}
            step={range.step}
            value={price}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) setPrice(Math.min(range.max, Math.max(0, value)));
            }}
          />
          <span aria-hidden="true">{perNight}</span>
        </span>
      </div>

      <p className={styles.finePrint}>{fillIn(lang, t.finePrint, { fee: formatPrice(lang, prices.yearlyFees[currency], currency) })}</p>
    </div>
  );
}
