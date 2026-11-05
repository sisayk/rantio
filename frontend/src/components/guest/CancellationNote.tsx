"use client";

// The cottage's cancellation policy in the booking column: the stay's own dates when the page
// address has them (?from=…&to=…, as the search passes them), else the policy's rule.
import { useEffect, useState } from "react";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import { CANCELLATION } from "@/i18n/messages/cancellation";
import { guestLines, LONG_STAY_NIGHTS, type LongPolicy, type Policy } from "@/lib/cancellation";
import styles from "./guest.module.css";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00Z`) - Date.parse(`${a}T12:00Z`)) / 86_400_000);

export default function CancellationNote({ lang, policy, longPolicy }: { lang: Lang; policy: Policy; longPolicy: LongPolicy }) {
  const t = CANCELLATION[lang];
  const [stay, setStay] = useState<{ from: string; to: string; today: string } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const from = q.get("from") ?? "";
    const to = q.get("to") ?? "";
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the address once
    if (DAY.test(from) && DAY.test(to) && to > from) setStay({ from, to, today });
  }, []);

  const nights = stay ? nightsBetween(stay.from, stay.to) : 0;
  const fmt = new Intl.DateTimeFormat(LANG_INFO[lang].intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const lines = guestLines(t, {
    policy,
    longPolicy,
    checkIn: stay?.from ?? null,
    nights,
    today: stay?.today ?? "",
    time: "15:00",
    day: (iso) => fmt.format(new Date(`${iso}T12:00Z`)),
  });

  return (
    <div className={styles.cancelNote}>
      <h3>
        {t.title} · {nights >= LONG_STAY_NIGHTS ? t.longNames[longPolicy] : t.names[policy]}
      </h3>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {!stay ? <p className={styles.cancelSoft}>{t.noDates}</p> : null}
      {nights < LONG_STAY_NIGHTS ? <p className={styles.cancelSoft}>{t.window}</p> : null}
      <p className={styles.cancelSoft}>{t.siteConfirms}</p>
    </div>
  );
}
