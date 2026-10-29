import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { CONTACT_EMAIL } from "@/lib/content";
import { getLegal, type LegalKind, legalLang, OTHER_LANGUAGE_NOTE } from "@/lib/legal";
import AppBadges from "./AppBadges";
import LanguageButton from "./LanguagePicker";
import { Logo } from "./guest/icons";
import styles from "./legal.module.css";

/** The privacy policy or the website terms: one readable column, in English or Finnish. */
export default function LegalPage({ lang, kind }: { lang: Lang; kind: LegalKind }) {
  const m = getMessages(lang);
  const textLang = legalLang(lang);
  const page = getLegal(lang)[kind];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href={paths.home(lang)}>
          <Logo className={styles.logo} />
          Stugora
        </a>
        <LanguageButton lang={lang} t={m.common.language} names={languageNamesIn(lang)} className={styles.langButton} />
      </header>

      <main className={styles.main}>
        <article className={styles.article} lang={textLang}>
          {textLang !== lang ? <p className={styles.languageNote}>{OTHER_LANGUAGE_NOTE}</p> : null}
          <h1>{page.title}</h1>
          <p className={styles.updated}>{page.updated}</p>
          <p className={styles.intro}>{page.intro}</p>
          {page.sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.list ? (
                <ul>
                  {s.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </main>

      <footer className={styles.footer}>
        <AppBadges t={m.common.apps} />
        <p>{m.common.footer.note}</p>
        <p className={styles.footerLinks}>
          <span>
            {m.common.footer.contact}: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
          <a href={paths.privacy(lang)} aria-current={kind === "privacy" ? "page" : undefined}>
            {m.common.footer.privacy}
          </a>
          <a href={paths.terms(lang)} aria-current={kind === "terms" ? "page" : undefined}>
            {m.common.footer.terms}
          </a>
        </p>
      </footer>
    </div>
  );
}
