"use client";
/* eslint-disable @next/next/no-img-element -- Wikipedia thumbnails */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import { findNearby, type NearbyPlace } from "@/lib/nearby";
import { External, Pin } from "./icons";
import styles from "./guest.module.css";

const AreaMap = dynamic(() => import("./AreaMap"), {
  ssr: false,
  loading: () => <div className={styles.areaMap} />,
});

const FIRST = 8;

type State = { status: "loading" } | { status: "ready"; places: NearbyPlace[] } | { status: "error" };

/** Places near the cottage, listed beside a map; loaded from Wikipedia in the browser. */
export default function Surroundings({ lang, lat, lng }: { lang: Lang; lat: number; lng: number }) {
  const t = guestContent[lang].detail;
  const [state, setState] = useState<State>({ status: "loading" });
  const [all, setAll] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    findNearby(lat, lng, lang, ctrl.signal)
      .then((places) => setState({ status: "ready", places }))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          console.warn("Nearby places failed", e);
          setState({ status: "error" });
        }
      });
    return () => ctrl.abort();
  }, [lat, lng, lang]);

  const places = state.status === "ready" ? state.places : [];
  const shown = all ? places : places.slice(0, FIRST);
  const km = (n: number) => {
    const metres = Math.max(100, Math.round(n * 10) * 100); // nearest 100 m
    return metres < 1000
      ? `${metres} m`
      : `${n.toLocaleString(guestContent[lang].locale, { maximumFractionDigits: n < 10 ? 1 : 0 })} km`;
  };

  return (
    <section className={styles.detailSection} aria-labelledby="nearby-title">
      <h2 id="nearby-title">{t.nearbyTitle}</h2>
      <p className={styles.sectionLead}>{t.nearbyLead}</p>
      <div className={styles.nearbyLayout}>
        <div>
          {state.status === "loading" ? (
            <ul className={styles.nearbyList} aria-busy="true" aria-label={t.loading}>
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className={styles.nearbySkeleton} />
              ))}
            </ul>
          ) : state.status === "error" ? (
            <p className={styles.nearbyNote}>{t.error}</p>
          ) : places.length === 0 ? (
            <p className={styles.nearbyNote}>{t.empty}</p>
          ) : (
            <>
              <ol className={styles.nearbyList}>
                {shown.map((p, i) => (
                  <li key={p.key} data-active={activeKey === p.key}>
                    <a
                      className={styles.nearbyItem}
                      href={p.url}
                      target="_blank"
                      rel="noopener"
                      onMouseEnter={() => setActiveKey(p.key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onFocus={() => setActiveKey(p.key)}
                      onBlur={() => setActiveKey(null)}
                    >
                      <span className={styles.nearbyThumb}>
                        {p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <Pin className={styles.icon20} />}
                        <span className={styles.nearbyNumber}>{i + 1}</span>
                      </span>
                      <span className={styles.nearbyText}>
                        <strong>{p.title}</strong>
                        <span>{p.description}</span>
                        <span className={styles.nearbyDistance}>
                          {km(p.km)} {t.away}
                        </span>
                      </span>
                      <External className={styles.icon16} />
                      <span className="visually-hidden">{t.readMore}</span>
                    </a>
                  </li>
                ))}
              </ol>
              {places.length > FIRST ? (
                <button type="button" className={styles.moreButton} onClick={() => setAll(!all)}>
                  {all ? t.showLess : t.showMore}
                </button>
              ) : null}
            </>
          )}
          <p className={styles.nearbySource}>{t.source}</p>
        </div>
        <div className={styles.areaMapWrap}>
          <AreaMap
            lat={lat}
            lng={lng}
            places={shown}
            activeKey={activeKey}
            label={t.map}
            cottageLabel={t.cottage}
            onHover={setActiveKey}
          />
        </div>
      </div>
    </section>
  );
}
