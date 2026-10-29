"use client";

import { useState } from "react";
import type { Messages } from "@/i18n";
import { money, plural } from "@/i18n/format";
import { LANG_INFO, type Lang } from "@/i18n/locales";
import type { Summary } from "@/lib/ownerApi";
import styles from "./owner.module.css";

// Validated pair (dataviz validator, light surface): CVD ΔE 12.2, normal 22.0.
// The amber is under 3:1 against white, so the legend, tooltip and table carry the values.
export const SERIES = { stugora: "#2f855f", own: "#cf9433" } as const;

const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 64 };
const BAR = 24;
const GAP = 2;

/** 0, a round step, ... at or above the highest month. */
function niceMax(max: number) {
  if (max <= 0) return 1000;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

/** A bar segment with 4px rounded top corners when it is the top of its stack. */
function segment(x: number, y: number, w: number, h: number, roundTop: boolean) {
  if (h <= 0) return "";
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ""}H${x + w - r}${
    r ? `Q${x + w},${y} ${x + w},${y + r}` : ""
  }V${y + h}Z`;
}

export default function EarningsChart({
  months,
  year,
  lang,
  t,
}: {
  months: Summary["months"];
  year: number;
  lang: Lang;
  t: Messages["dashboard"];
}) {
  const eur = (v: number) => money(lang, v);
  const [hover, setHover] = useState<number | null>(null);
  const rows = months.map((m) => ({ ...m, stugora: Number(m.stugora), own: Number(m.own) }));
  const top = niceMax(Math.max(...rows.map((r) => r.stugora + r.own)));
  const plotH = H - PAD.top - PAD.bottom;
  const band = (W - PAD.left - PAD.right) / 12;
  const y = (v: number) => (v / top) * plotH;
  // Rendered only in the browser, after the figures load, so Intl's month names are safe here.
  const intl = LANG_INFO[lang].intl;
  const monthName = new Intl.DateTimeFormat(intl, { month: "short" });
  const monthLong = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" });
  const label = (m: number) => monthName.format(new Date(year, m - 1, 1)).replace(".", "");
  const ticks = [0, top / 2, top];
  const active = hover === null ? null : rows[hover];
  const at = hover ?? 0;

  return (
    <figure className={styles.chart}>
      <ul className={styles.legend}>
        <li>
          <span style={{ background: SERIES.stugora }} />
          {t.chart.stugora}
        </li>
        <li>
          <span style={{ background: SERIES.own }} />
          {t.chart.own} ({t.chart.ownNote})
        </li>
      </ul>
      <div className={styles.chartBox}>
        <div className={styles.chartInner} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.chart.title}>
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={PAD.top + plotH - y(v)}
                  y2={PAD.top + plotH - y(v)}
                  className={styles.grid}
                />
                <text x={PAD.left - 8} y={PAD.top + plotH - y(v) + 4} className={styles.tick} textAnchor="end">
                  {v === 0 ? "0" : eur(v)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const x = PAD.left + band * i + (band - BAR) / 2;
              const base = PAD.top + plotH;
              const hs = y(r.stugora);
              const ho = y(r.own);
              const gap = hs > 0 && ho > 0 ? GAP : 0;
              const dim = hover !== null && hover !== i;
              return (
                <g key={r.month} opacity={dim ? 0.45 : 1}>
                  <path d={segment(x, base - hs, BAR, hs, ho <= 0)} fill={SERIES.stugora} />
                  <path d={segment(x, base - hs - gap - ho, BAR, ho, true)} fill={SERIES.own} />
                  <text x={x + BAR / 2} y={H - 8} className={styles.tick} textAnchor="middle">
                    {label(r.month)}
                  </text>
                  {/* hit target: the whole month column, larger than the bar */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${monthLong.format(new Date(year, r.month - 1, 1))}: ${eur(r.stugora + r.own)}`}
                  />
                </g>
              );
            })}
          </svg>
          {active ? (
            <div
              className={styles.tooltip}
              style={{
                left: `${((PAD.left + band * at + band / 2) / W) * 100}%`,
                transform: at > 8 ? "translateX(-100%)" : at < 3 ? "none" : "translateX(-50%)",
              }}
              role="status"
            >
              <strong>{monthLong.format(new Date(year, active.month - 1, 1))}</strong>
              <span>
                <i style={{ background: SERIES.stugora }} />
                {t.chart.stugora}: {eur(active.stugora)}
              </span>
              <span>
                <i style={{ background: SERIES.own }} />
                {t.chart.own}: {eur(active.own)}
              </span>
              <span className={styles.tooltipTotal}>
                {t.chart.total}: {eur(active.stugora + active.own)} · {plural(lang, t.nights, active.nights)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <details className={styles.chartTable}>
        <summary>{t.chart.table}</summary>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.chart.month}</th>
                <th scope="col">{t.chart.stugora}</th>
                <th scope="col">{t.chart.own}</th>
                <th scope="col">{t.chart.total}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <th scope="row">{monthLong.format(new Date(year, r.month - 1, 1))}</th>
                  <td>{eur(r.stugora)}</td>
                  <td>{eur(r.own)}</td>
                  <td>{eur(r.stugora + r.own)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
