"use client";

import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { useOwnerSession } from "@/lib/useOwnerSession";

/** "Become a host" (or "Sign in") for visitors; "Switch to hosting" for a signed-in owner, as on Airbnb. */
export default function HostSwitchLink({
  lang,
  becomeHost,
  switchToHosting,
  className,
  signedOutHref,
}: {
  lang: Lang;
  becomeHost: string;
  switchToHosting: string;
  className?: string;
  /** Where the link goes for visitors (default: the page for cottage owners). */
  signedOutHref?: string;
}) {
  const owner = useOwnerSession();
  // Signed in but not hosting yet: "Become a host" opens the listing form, filled in for them.
  if (owner && !owner.isHost) {
    return (
      <a className={className} href={`${paths.hosts(lang)}#ilmoita`}>
        {becomeHost}
      </a>
    );
  }
  return owner ? (
    <a className={className} href={paths.hosting(lang)}>
      {switchToHosting}
    </a>
  ) : (
    <a className={className} href={signedOutHref ?? paths.hosts(lang)}>
      {becomeHost}
    </a>
  );
}
