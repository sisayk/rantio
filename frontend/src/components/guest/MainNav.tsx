import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";

export type NavPage = "stays" | "experiences" | "destinations" | "inspiration" | "hosts";
const PAGES: NavPage[] = ["stays", "experiences", "destinations", "inspiration"];

/** The guest side's main menu: Stays, Experiences, Destinations, Inspiration (labels in guest.nav). */
export default function MainNav({
  lang,
  labels,
  active,
  className,
  staysHref,
  hostsLabel,
}: {
  lang: Lang;
  labels: readonly string[];
  active?: NavPage;
  className?: string;
  /** On the homepage "Stays" only scrolls to the list, keeping the search in the address. */
  staysHref?: string;
  /** Adds "For hosts" after the guest pages (the hosts page shows it, as the page you're on). */
  hostsLabel?: string;
}) {
  const href: Record<NavPage, string> = {
    stays: staysHref ?? `${paths.home(lang)}#majoitus`,
    experiences: paths.experiences(lang),
    destinations: paths.destinations(lang),
    inspiration: paths.inspiration(lang),
    hosts: paths.hosts(lang),
  };
  return (
    <nav className={className} aria-label="Rantio">
      {PAGES.map((page, i) => (
        <a key={page} href={href[page]} aria-current={page === active ? "page" : undefined}>
          {labels[i]}
        </a>
      ))}
      {hostsLabel ? (
        <a href={href.hosts} aria-current={active === "hosts" ? "page" : undefined}>
          {hostsLabel}
        </a>
      ) : null}
    </nav>
  );
}
