"use client";

/* eslint-disable @next/next/no-img-element -- a bundled render, sized by CSS */
import { useEffect, useState } from "react";
import monitorPhoto from "@/assets/mokki-monitor.jpg";
import type { Messages } from "@/i18n";
import { ownerApi } from "@/lib/ownerApi";
import styles from "./owner.module.css";

/** Overview: the Mökki monitor, coming soon; one tap puts the owner on the waitlist. */
export default function MonitorCard({ t }: { t: Messages["owner"]["monitor"] }) {
  const [joined, setJoined] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    ownerApi.monitor().then((r) => setJoined(r.joined), () => setJoined(false));
  }, []);

  const join = async () => {
    setWorking(true);
    setFailed(false);
    try {
      setJoined((await ownerApi.joinMonitor()).joined);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  return (
    <section id="monitor" aria-labelledby="monitor-title" className={`${styles.section} ${styles.card} ${styles.monitorCard}`}>
      <img className={styles.monitorPhoto} src={monitorPhoto.src} alt={t.photoAlt} width={1200} height={900} loading="lazy" />
      <div className={styles.monitorBody}>
        <span className={styles.monitorBadge}>{t.badge}</span>
        <h2 id="monitor-title">{t.title}</h2>
        <p className={styles.lead}>{t.lead}</p>
        <ul className={styles.monitorFeatures}>
          {t.features.map((f) => (
            <li key={f.key}>
              <strong>{f.title}</strong> {f.body}
            </li>
          ))}
        </ul>
        {joined ? (
          <p className={styles.monitorDone} role="status">
            {t.done}
          </p>
        ) : (
          <div className={styles.monitorActions}>
            <button type="button" className={styles.primary} disabled={working || joined === null} onClick={join}>
              {working ? t.sending : t.submit}
            </button>
          </div>
        )}
        {!joined ? <p className={styles.muted}>{failed ? t.errors.network : t.consent}</p> : null}
      </div>
    </section>
  );
}
