import { getMessages } from "@/i18n";
import { languageNamesIn } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { getLegal, type LegalKind, legalLang, OTHER_LANGUAGE_NOTE } from "@/lib/legal";
import LanguageButton from "./LanguagePicker";
import { Wordmark } from "./guest/icons";
import styles from "./legal.module.css";
import SiteFooter from "./SiteFooter";

/** The privacy policy or the website terms: one readable column, in English or Finnish. */
export default function LegalPage({ lang, kind }: { lang: Lang; kind: LegalKind }) {
  const m = getMessages(lang);
  const textLang = legalLang(lang);
  const page = getLegal(lang)[kind];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href={paths.home(lang)}>
          <Wordmark />
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

      <SiteFooter lang={lang} variant="legal" current={kind} />
    </div>
  );
}
