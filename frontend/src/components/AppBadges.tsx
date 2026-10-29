import { APP_LINKS } from "@/lib/content";
import styles from "./AppBadges.module.css";

type Texts = { title: string; soon: string; download: string };

const STORES = [
  { id: "ios", name: "App Store", platform: "iPhone", href: APP_LINKS.ios },
  { id: "android", name: "Google Play", platform: "Android", href: APP_LINKS.android },
] as const;

/** iPhone and Android download buttons for the footer; "Coming soon" until a store link is set. */
export default function AppBadges({ t }: { t: Texts }) {
  return (
    <div className={styles.apps}>
      <p className={styles.title}>{t.title}</p>
      <div className={styles.badges}>
        {STORES.map((s) => {
          const live = Boolean(s.href);
          const inner = (
            <>
              <PhoneIcon kind={s.id} />
              <span className={styles.text}>
                <small>{live ? t.download : t.soon}</small>
                <strong>{s.name}</strong>
              </span>
            </>
          );
          return live ? (
            <a key={s.id} className={styles.badge} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.platform}: ${t.download} ${s.name}`}>
              {inner}
            </a>
          ) : (
            <span key={s.id} className={`${styles.badge} ${styles.soon}`} aria-label={`${s.platform}: ${s.name}, ${t.soon}`} title={t.soon}>
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A plain phone outline: rounded for iPhone, with a speaker slot; squarer with a camera dot for Android. */
function PhoneIcon({ kind }: { kind: "ios" | "android" }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      {kind === "ios" ? (
        <>
          <rect x="6" y="2" width="12" height="20" rx="3.2" />
          <path d="M10.5 4.6h3" />
          <path d="M10 19h4" />
        </>
      ) : (
        <>
          <rect x="5.5" y="2" width="13" height="20" rx="1.8" />
          <circle cx="12" cy="4.8" r="0.6" fill="currentColor" />
          <path d="M9.5 19.2h5" />
        </>
      )}
      <path d="M12 8.5v6m-2.6-2.6L12 14.5l2.6-2.6" />
    </svg>
  );
}
