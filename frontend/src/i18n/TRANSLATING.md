# Translating Stugora

English (`messages/en.ts`) is the source and the fallback. Each language has one
file, `messages/<code>.ts`, exporting a `Translation` with the same shape. Anything a
language leaves out shows in English, and `npm run i18n:check <code>` lists it.

Stugora lists Nordic and Baltic cottages on Airbnb, Booking.com, Vrbo and other
sites for their owners. Guests browse example cottages here and book on those sites.
The owner pages (`owner`) speak to cottage owners anywhere in the Nordics and the
Baltics; the first pilot cottages are in Finland, so Nettimökki (Finland's own
cottage site) is the example of "a local site you already use".

## Rules

- Write the way a good local copywriter would, not word for word. Short, warm,
  plain. Use the informal "you" where the language normally does on consumer sites
  (Finnish "sinä", Swedish/Norwegian/Danish "du", Icelandic "þú", Estonian "sina",
  Latvian "tu"/plural as sites usually do — Latvian and Lithuanian sites often use
  the polite "jūs/Jūs"; pick what local booking sites use and stay consistent).
- Keep these exactly: Stugora, Airbnb, Booking.com, Vrbo, Nettimökki, Wikipedia,
  Unsplash, Elda-Auto Tmi, CC BY-SA, every `{placeholder}`.
- Write prices, percentages and dates the local way: "99 €" or "€99", "12 %" or
  "12%", "12.–15. juli", whatever the language uses.
- Lists (nav, steps, faq items, cards) keep the same number of items, same order.
- Plural objects need every form the language's plural rules use (CLDR):
  sv, nb, nn, da, is, et: `one`, `other`. lv: `zero`, `one`, `other`
  (zero covers 0, 10–20, 30, …; one covers 1, 21, 31 but not 11).
  lt: `one`, `few`, `many`, `other` (one: 1, 21, 31…; few: 2–9, 22–29…;
  many: fractions; other: 0, 10–20, 30…). Icelandic `one` also covers 21, 31, …
  Every form keeps `{n}`.
- Grammar that depends on a noun (the water in `activities.swim` and
  `activities.sauna.withWater`) comes in one full sentence per kind of water, so
  inflect freely.
- `listingNames`: translate descriptive names naturally; keep real place names in
  their local or usual form in that language (Lofoten, Saimaa, Nuuksio; Swedish
  writes Lojo, Sibbo, Noux for the Finnish towns).
- `owner.form.regions` are Finnish regions; use the names the language uses for them.
- `common.footer.note` is the legal trading-name line: translate "trading name"
  (Finnish "aputoiminimi") with the language's usual business term.
