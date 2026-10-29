"use client";

import type { Messages } from "@/i18n";
import type { Lang } from "@/i18n/locales";
import { CURRENCIES, type Currency, currencySign, isCurrency } from "@/lib/currency";
import { useMoney } from "@/lib/useMoney";
import styles from "./CurrencyButton.module.css";

/** The visitor's currency for every price on the site, remembered in this browser. */
export default function CurrencyButton({
  lang,
  t,
  names,
  className,
  row = false,
}: {
  lang: Lang;
  t: Messages["guest"]["currency"];
  names: Record<Currency, string>;
  className?: string;
  /** As a line in a menu: "€  Currency  EUR". */
  row?: boolean;
}) {
  const { currency, setCurrency } = useMoney(lang);
  const sign = currencySign(lang, currency);
  return (
    <label className={`${styles.wrap} ${row ? styles.row : ""} ${className ?? ""}`} title={t.title}>
      <span className={styles.sign} aria-hidden="true">
        {sign.length > 2 ? "¤" : sign}
      </span>
      {row ? <span>{t.button}</span> : <span className="visually-hidden">{t.button}</span>}
      <span className={row ? styles.rowValue : undefined}>{currency}</span>
      <select
        className={styles.select}
        value={currency}
        onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)}
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c} – {names[c]}
          </option>
        ))}
      </select>
    </label>
  );
}
