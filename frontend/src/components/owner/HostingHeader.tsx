"use client";

import type { Messages } from "@/i18n";
import { number } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { ownerApi } from "@/lib/ownerApi";
import { forgetOwnerSession } from "@/lib/useOwnerSession";
import { Wordmark } from "../guest/icons";
import styles from "./owner.module.css";

function TabIcon({ d }: { d: string }) {
  return (
    <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Top of every hosting page: brand, the Overview / Calendar / My listings / Messages tabs (a bar at
 *  the bottom of the screen on phones), the switch to the guest
 *  side (as on Airbnb), language and sign-out. */
export default function HostingHeader({
  lang,
  t,
  languageButton,
  active,
  ownerName,
  unread = 0,
}: {
  lang: Lang;
  t: Messages["dashboard"];
  languageButton: React.ReactNode;
  active: "overview" | "calendar" | "listings" | "messages" | "account";
  ownerName?: string;
  unread?: number;
}) {
  async function logout() {
    await ownerApi.logout().catch(() => undefined);
    forgetOwnerSession();
    window.location.assign(paths.hostingLogin(lang));
  }
  return (
    <header className={styles.top}>
      <div className={styles.topInner}>
        <a className={styles.brand} href={paths.home(lang)}>
          <Wordmark />
          <span className={styles.area}>{t.area}</span>
        </a>
        <nav className={styles.tabs} aria-label={t.area}>
          <a href={paths.hosting(lang)} aria-current={active === "overview" ? "page" : undefined}>
            <TabIcon d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
            <span>{t.nav.overview}</span>
          </a>
          <a href={paths.hostingCalendar(lang)} aria-current={active === "calendar" ? "page" : undefined}>
            <TabIcon d="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4" />
            <span>{t.nav.calendar}</span>
          </a>
          <a href={paths.hostingListings(lang)} aria-current={active === "listings" ? "page" : undefined}>
            <TabIcon d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
            <span>{t.nav.listings}</span>
          </a>
          <a href={paths.hostingMessages(lang)} aria-current={active === "messages" ? "page" : undefined}>
            <TabIcon d="M4 5h16v11H9l-5 4V5Z" />
            <span>{t.nav.messages}</span>
            {unread ? <span className={styles.badge}>{number(lang, unread)}</span> : null}
          </a>
        </nav>
        <div className={styles.topNav}>
          <a className={styles.switchLink} href={paths.home(lang)}>
            {t.switchToTraveling}
          </a>
          {languageButton}
          {ownerName ? (
            <a className={styles.who} href={paths.hostingAccount(lang)} aria-current={active === "account" ? "page" : undefined}>
              {ownerName}
            </a>
          ) : null}
          <button type="button" className={styles.outline} onClick={logout}>
            {t.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
