export type Lang = "fi" | "en";

export const REGIONS = ["saimaa", "lakeland", "lapland", "helsinki", "coast", "other"] as const;
export type Region = (typeof REGIONS)[number];

export const CONTACT_EMAIL = "hello@stugora.fi";

const fi = {
  locale: "fi-FI",
  meta: {
    title: "Stugora – mökkisi Airbnbhin, Booking.comiin ja Vrbo:hon",
    description:
      "Stugora tuo mökillesi ulkomaisia vieraita ja pitää kalenterit samassa tahdissa Nettimökin kanssa. 99 € vuodessa ja 12 % tuomistamme varauksista.",
  },
  nav: { otherLang: "In English", otherHref: "/en/hosts", cta: "Ilmoita mökkisi" },
  hero: {
    before: "Mökkisi voisi tienata",
    after: "lisää vuodessa",
    nightsLabel: "Lisäyöt vuodessa",
    nights: (n: number) => `${n} lisäyötä`,
    priceLabel: "Hinta yöltä",
    perNight: "€ / yö",
    finePrint:
      "Arviosta on vähennetty alustojen palkkiot (noin 15 %), Stugoran 99 € vuosimaksu, 12 % palkkio ja arvonlisävero.",
    lead:
      "Stugora vie mökkisi Airbnbhin, Booking.comiin ja Vrbo:hon ja pitää kalenterit samassa tahdissa Nettimökin kanssa.",
    cta: "Ilmoita mökkisi",
  },
  calendar: {
    title: "Nettimökki jatkuu, tyhjät viikot täyttyvät",
    lead: "Kun yhdestä kanavasta varataan, samat päivät suljetaan kaikkialta. Näin heinäkuu voisi näyttää Saimaan mökillä.",
    month: "Heinäkuu 2027",
    weekdays: ["ma", "ti", "ke", "to", "pe", "la", "su"],
    existing: "Nettimökin varaukset, kuten ennenkin",
    added: "Uudet varaukset ulkomailta",
  },
  how: {
    title: "Näin se toimii",
    steps: [
      {
        title: "Kerrot mökistä kerran",
        body: "Kuvat, hinnat ja säännöt yhdellä lomakkeella tai puhelimessa. Kirjoitamme ilmoitukset englanniksi puolestasi.",
      },
      {
        title: "Avaamme uudet kanavat",
        body: "Mökkisi näkyy Airbnbssa, Booking.comissa ja Vrbo:ssa. Kalenterit päivittyvät keskenään, myös Nettimökin varausten kanssa.",
      },
      {
        title: "Vieras varaa, sinä saat rahat",
        body: "Alusta tilittää maksun suoraan sinulle. Vastaat vieraille itse, valmiiden englanninkielisten viestipohjien avulla.",
      },
    ],
  },
  price: {
    title: "99 € vuodessa ja 12 % tuomistamme varauksista",
    lead:
      "Ei aloitus- eikä kuukausimaksua. Vuosimaksu kattaa ilmoitusten tekemisen ja ylläpidon. Kun vieras varaa Stugoran avaaman kanavan kautta, maksat 12 % summasta, jonka alusta tilittää sinulle. Hintoihin lisätään alv 25,5 %. Nettimökin varauksista emme veloita koskaan.",
    exampleTitle: "Esimerkki: 20 lisäyötä, 150 € yöltä",
    rows: [
      { label: "Vieraiden maksut", value: "3 000 €" },
      { label: "Alustojen palkkiot, noin 15 %", value: "−450 €" },
      { label: "Stugoran palkkio 12 % ja alv", value: "−384 €" },
      { label: "Vuosimaksu 99 € ja alv", value: "−124 €" },
    ],
    total: { label: "Jää sinulle", value: "noin 2 040 €" },
    terms: "Ilmoitukset ovat voimassa 12 kuukautta kerrallaan ja jatkuvat vuosimaksulla.",
  },
  faq: {
    title: "Kysyttyä",
    items: [
      {
        q: "Pitääkö Nettimökistä luopua?",
        a: "Ei. Nettimökki jatkuu kuten ennenkin. Luemme sen varausvahvistukset ja suljemme samat päivät muualta.",
      },
      {
        q: "Kuka hoitaa vieraat?",
        a: "Sinä, kuten nytkin. Saat valmiit viestipohjat englanniksi, ja me hoidamme ilmoituksiin ja kalenteriin liittyvät ongelmat.",
      },
      {
        q: "Miksi vuosimaksu?",
        a: "Ilmoitusten kirjoittaminen, kuvien valinta ja kalenterien yhdistäminen vie työtä jo ennen ensimmäistä varausta. Vuosimaksu kattaa sen.",
      },
      {
        q: "Mitä minulta tarvitaan?",
        a: "Hyvät kuvat, hinnat ja säännöt sekä tilit Airbnbhin, Booking.comiin ja Vrbo:hon. Autamme tilien avaamisessa.",
      },
      {
        q: "Missä toimitte?",
        a: "Kaikkialla Pohjoismaissa ja Baltiassa: Suomessa, Ruotsissa, Norjassa, Tanskassa, Islannissa, Virossa, Latviassa ja Liettuassa. Ensimmäiset pilottimökit ovat Saimaalla ja Lapissa.",
      },
    ],
  },
  form: {
    title: "Ilmoita mökkisi",
    lead: "Kerro mökistäsi, niin otamme yhteyttä. Ilmoittautuminen ei sido sinua mihinkään.",
    name: "Nimi",
    email: "Sähköposti",
    phone: "Puhelin",
    region: "Missä mökki on?",
    regionPlaceholder: "Valitse alue tai maa",
    otherCountries: "Muut maat",
    countries: { FI: "Suomi", SE: "Ruotsi", NO: "Norja", DK: "Tanska", IS: "Islanti", EE: "Viro", LV: "Latvia", LT: "Liettua" },
    regions: {
      saimaa: "Saimaa",
      lakeland: "Muu Järvi-Suomi",
      lapland: "Lappi",
      helsinki: "Helsingin seutu",
      coast: "Rannikko tai saaristo",
      other: "Muualla Suomessa",
    } as Record<Region, string>,
    count: "Montako mökkiä?",
    nettimokki: "Linkki Nettimökki-ilmoitukseen",
    message: "Jotain muuta, mitä haluat kertoa?",
    optional: "vapaaehtoinen",
    consent: "Stugora saa tallentaa nämä tiedot ja ottaa minuun yhteyttä.",
    submit: "Ilmoita mökkisi",
    sending: "Lähetetään…",
    successTitle: "Kiitos!",
    success: (name: string) => `${name}, otamme sinuun pian yhteyttä.`,
    errors: {
      required: "Täytä tämä kenttä.",
      email: "Tarkista sähköpostiosoite.",
      consent: "Tarvitsemme luvan, jotta voimme ottaa yhteyttä.",
      nettimokki: "Liitä linkki Nettimökki-ilmoitukseesi.",
      tooMany: "Liian monta yritystä. Odota hetki ja yritä uudelleen.",
      network: `Lähetys ei onnistunut. Yritä uudelleen tai kirjoita osoitteeseen ${CONTACT_EMAIL}.`,
    },
  },
  footer: {
    note: "Stugora on Elda-Auto Tmi:n aputoiminimi.",
    contact: "Yhteys",
  },
};

export type Content = typeof fi;

const en: Content = {
  locale: "en-IE",
  meta: {
    title: "Stugora – your cottage on Airbnb, Booking.com and Vrbo",
    description:
      "Stugora brings guests from abroad to your cottage anywhere in the Nordics or the Baltics and keeps calendars in step with the sites you already use. €99 a year and 12% of the bookings we bring.",
  },
  nav: { otherLang: "Suomeksi", otherHref: "/omistajille", cta: "List your cottage" },
  hero: {
    before: "Your cottage could earn",
    after: "more a year",
    nightsLabel: "Extra nights a year",
    nights: (n: number) => `${n} extra nights`,
    priceLabel: "Price per night",
    perNight: "€ / night",
    finePrint:
      "The estimate takes off platform fees (about 15%), Stugora's €99 yearly fee, the 12% commission and VAT.",
    lead:
      "Stugora puts your cottage on Airbnb, Booking.com and Vrbo and keeps every calendar in step with the local sites you already use, such as Nettimökki in Finland.",
    cta: "List your cottage",
  },
  calendar: {
    title: "Nettimökki carries on, the empty weeks fill",
    lead: "When one channel books, the same dates close everywhere. This is how July could look at a Saimaa cottage.",
    month: "July 2027",
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    existing: "Nettimökki bookings, as before",
    added: "New bookings from abroad",
  },
  how: {
    title: "How it works",
    steps: [
      {
        title: "Tell us about your cottage once",
        body: "Photos, prices and rules in one form or over the phone. We write the English listings for you.",
      },
      {
        title: "We open the new channels",
        body: "Your cottage appears on Airbnb, Booking.com and Vrbo. The calendars update each other, including bookings from the sites you already use.",
      },
      {
        title: "Guests book, you get paid",
        body: "The platform pays you directly. You answer guests yourself, with ready-made English message templates.",
      },
    ],
  },
  price: {
    title: "€99 a year and 12% of the bookings we bring",
    lead:
      "No setup fee and no monthly fee. The yearly fee covers making and keeping up your listings. When a guest books through a channel Stugora opened, you pay 12% of what the platform pays you. VAT is added to both. We never charge for bookings from the sites you already used before, such as Nettimökki.",
    exampleTitle: "Example: 20 extra nights at €150 a night",
    rows: [
      { label: "Guests pay", value: "€3,000" },
      { label: "Platform fees, about 15%", value: "−€450" },
      { label: "Stugora 12% plus VAT", value: "−€384" },
      { label: "Yearly fee €99 plus VAT", value: "−€124" },
    ],
    total: { label: "You keep", value: "about €2,040" },
    terms: "Listings run for 12 months at a time and renew with the yearly fee.",
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "Do I have to leave the sites I already use?",
        a: "No. Nettimökki in Finland, or any local site you use, carries on as before. When a booking comes in anywhere, we close the same dates everywhere else.",
      },
      {
        q: "Who looks after the guests?",
        a: "You do, as now. You get ready-made English message templates, and we handle any listing or calendar problems.",
      },
      {
        q: "Why a yearly fee?",
        a: "Writing the listings, choosing photos and linking the calendars takes work before the first booking. The yearly fee covers it.",
      },
      {
        q: "What do you need from me?",
        a: "Good photos, prices and rules, plus accounts on Airbnb, Booking.com and Vrbo. We help you open them.",
      },
      {
        q: "Where do you work?",
        a: "Across the Nordics and the Baltics: Finland, Sweden, Norway, Denmark, Iceland, Estonia, Latvia and Lithuania. Our first pilot cottages are in the Saimaa region and Lapland.",
      },
    ],
  },
  form: {
    title: "List your cottage",
    lead: "Tell us about your cottage and we'll get in touch. Signing up doesn't commit you to anything.",
    name: "Name",
    email: "Email",
    phone: "Phone",
    region: "Where is the cottage?",
    regionPlaceholder: "Choose a region or country",
    otherCountries: "Other countries",
    countries: { FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", IS: "Iceland", EE: "Estonia", LV: "Latvia", LT: "Lithuania" },
    regions: {
      saimaa: "Saimaa",
      lakeland: "Elsewhere in Lakeland",
      lapland: "Lapland",
      helsinki: "Helsinki region",
      coast: "Coast or archipelago",
      other: "Elsewhere in Finland",
    },
    count: "How many cottages?",
    nettimokki: "Link to your Nettimökki listing",
    message: "Anything else you'd like to tell us?",
    optional: "optional",
    consent: "Stugora may store these details and contact me.",
    submit: "List your cottage",
    sending: "Sending…",
    successTitle: "Thank you!",
    success: (name: string) => `${name}, we'll be in touch soon.`,
    errors: {
      required: "Fill in this field.",
      email: "Check the email address.",
      consent: "We need your permission to contact you.",
      nettimokki: "Paste the link to your Nettimökki listing.",
      tooMany: "Too many attempts. Wait a moment and try again.",
      network: `Sending failed. Try again or email ${CONTACT_EMAIL}.`,
    },
  },
  footer: {
    note: "Stugora is a trading name of Elda-Auto Tmi.",
    contact: "Contact",
  },
};

export const content: Record<Lang, Content> = { fi, en };

// Same assumptions as the business plan (28 Oct 2026).
export const PLATFORM_FEE = 0.15;
export const COMMISSION = 0.12;
export const YEARLY_FEE = 99;
export const VAT = 0.255;

export function ownerNetGain(nights: number, pricePerNight: number): number {
  const payout = nights * pricePerNight * (1 - PLATFORM_FEE);
  const stugora = payout * COMMISSION * (1 + VAT) + YEARLY_FEE * (1 + VAT);
  return Math.max(0, payout - stugora);
}
