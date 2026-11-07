import { getMessages } from "@/i18n";
import { languageNamesIn, number } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { getLegal, type LegalKind, legalLang, OTHER_LANGUAGE_NOTE } from "@/lib/legal";
import { type Prices, withPrices } from "@/lib/prices";
import { getPrices } from "@/lib/prices.server";
import LanguageButton from "./LanguagePicker";
import { Wordmark } from "./guest/icons";
import styles from "./legal.module.css";
import SiteFooter from "./SiteFooter";

/** The yearly fees in the terms, with the currency written out: "SEK 1,080" / "1 080 SEK", "99 euroa". */
function feeVars(lang: Lang, prices: Prices): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [code, amount] of Object.entries(prices.yearlyFees)) {
    const n = number(lang, amount, { max: 2 });
    out[code] = code === "EUR" ? (lang === "en" ? `€${n}` : `${n} euroa`) : lang === "en" ? `${code} ${n}` : `${n} ${code}`;
  }
  return out;
}

/** The privacy policy or the website terms: one readable column, in English or Finnish. The prices
 *  in them ({commission}, {period}, {EUR}…) are the ones set in the admin. */
export default async function LegalPage({ lang, kind }: { lang: Lang; kind: LegalKind }) {
  const m = getMessages(lang);
  const textLang = legalLang(lang);
  const prices = await getPrices();
  const fees = feeVars(textLang, prices);
  const page = withPrices(textLang, getLegal(lang)[kind], prices);
  const feesIn = (text: string) => text.replace(/\{(EUR|SEK|NOK|DKK|ISK)\}/g, (_, c: string) => fees[c]);

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
                <p key={p}>{feesIn(p)}</p>
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
