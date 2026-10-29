/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Lists every missing or broken translation: absent keys, plural forms a
// language's grammar needs, list lengths and {placeholders}.
// In a normal terminal:  cd ~/stugora/frontend && npm run i18n:check [lang ...]
require("./ts-hook.cjs");
const { findGaps } = require("../src/i18n/index.ts");
const { LANGS } = require("../src/i18n/locales.ts");

const wanted = process.argv.slice(2);
const langs = wanted.length ? wanted : LANGS;
let total = 0;
for (const lang of langs) {
  if (!LANGS.includes(lang)) {
    console.error(`Unknown language: ${lang}`);
    process.exit(2);
  }
  const gaps = findGaps(lang);
  total += gaps.length;
  console.log(`${lang}: ${gaps.length ? `${gaps.length} to fix` : "complete"}`);
  for (const g of gaps.slice(0, 40)) console.log(`  ${g.problem.padEnd(11)} ${g.key}`);
  if (gaps.length > 40) console.log(`  … and ${gaps.length - 40} more`);
}
process.exit(total ? 1 : 0);
