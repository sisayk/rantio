import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";

export type NavPage = "stays" | "experiences" | "destinations" | "inspiration";
const PAGES: NavPage[] = ["stays", "experiences", "destinations", "inspiration"];

/** The guest side's main menu: Stays, Experiences, Destinations, Inspiration (labels in guest.nav). */
export default function MainNav({
  lang,
  labels,
  active,
  className,
  staysHref,
}: {
  lang: Lang;
  labels: readonly string[];
  active?: NavPage;
  className?: string;
  /** On the homepage "Stays" only scrolls to the list, keeping the search in the address. */
  staysHref?: string;
}) {
  const href: Record<NavPage, string> = {
    stays: staysHref ?? `${paths.home(lang)}#majoitus`,
    experiences: paths.experiences(lang),
    destinations: paths.destinations(lang),
    inspiration: paths.inspiration(lang),
  };
  return (
    <nav className={className} aria-label="Rantio">
      {PAGES.map((page, i) => (
        <a key={page} href={href[page]} aria-current={page === active ? "page" : undefined}>
          {labels[i]}
        </a>
      ))}
    </nav>
  );
}
