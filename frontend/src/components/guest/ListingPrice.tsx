"use client";

import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import type { Currency } from "@/lib/currency";
import { useMoney } from "@/lib/useMoney";
import styles from "./guest.module.css";

/** A cottage's nightly price in the visitor's currency; when converted, "about" and the cottage's own price. */
export default function ListingPrice({
  lang,
  amount,
  currency,
  night,
  t,
}: {
  lang: Lang;
  amount: number;
  currency: Currency;
  night: string;
  t: Messages["guest"]["currency"];
}) {
  const money = useMoney(lang);
  const p = money.show(amount, currency);
  return (
    <>
      <p className={styles.bookPrice}>
        <strong>{p.converted ? fill(lang, t.about, { price: p.text }) : p.text}</strong> {night}
      </p>
      {p.converted ? (
        <p className={styles.bookOriginal} title={t.note}>
          {fill(lang, t.original, { price: money.format(amount, currency) })}
        </p>
      ) : null}
    </>
  );
}
