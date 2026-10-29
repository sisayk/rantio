"use client";

import type { Messages } from "@/i18n";
import { number } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { ownerApi } from "@/lib/ownerApi";
import { forgetOwnerSession } from "@/lib/useOwnerSession";
import { Logo } from "../guest/icons";
import styles from "./owner.module.css";

/** Top of every hosting page: brand, the Overview / Messages tabs, the switch to the guest
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
  active: "overview" | "messages";
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
          <Logo className={styles.logo} />
          Stugora
          <span className={styles.area}>{t.area}</span>
        </a>
        <nav className={styles.tabs} aria-label={t.area}>
          <a href={paths.hosting(lang)} aria-current={active === "overview" ? "page" : undefined}>
            {t.nav.overview}
          </a>
          <a href={paths.hostingMessages(lang)} aria-current={active === "messages" ? "page" : undefined}>
            {t.nav.messages}
            {unread ? <span className={styles.badge}>{number(lang, unread)}</span> : null}
          </a>
        </nav>
        <div className={styles.topNav}>
          <a className={styles.switchLink} href={paths.home(lang)}>
            {t.switchToTraveling}
          </a>
          {languageButton}
          {ownerName ? <span className={styles.who}>{ownerName}</span> : null}
          <button type="button" className={styles.outline} onClick={logout}>
            {t.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
