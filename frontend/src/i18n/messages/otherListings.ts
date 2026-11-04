import type { Lang } from "../locales";

/** The owner's listings on other sites (Nettimökki, Lomarengas, Mökkivuokra…), in the listing
 *  editor and the app's cottage settings. Kept apart so the 10 languages sit side by side. */
export type OtherListingsText = {
  title: string;
  lead: string;
  url: string;
  calendar: string;
  calendarHint: string;
  add: string;
  adding: string;
  remove: string;
  open: string;
  addCalendar: string;
  save: string;
  cancel: string;
  none: string;
  nettimokki: string;
  lastRead: string;
  states: Record<"none" | "pending" | "connected" | "failed", string>;
  errors: Record<"already_added" | "too_many" | "https" | "invalid" | "other", string>;
};

export type OtherListing = {
  id: number;
  site: string;
  name: string;
  url: string;
  calendar_url: string;
  calendar_state: "none" | "pending" | "connected" | "failed";
  calendar_error: string;
  last_synced_at: string | null;
};

/** The error text for a refused link, from the server's answer. */
export function linkError(t: OtherListingsText, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const first = (k: string) => (Array.isArray(b[k]) ? String((b[k] as unknown[])[0]) : "");
  const code = first("url") || first("calendar_url");
  if (code === "already_added" || code === "too_many" || code === "https") return t.errors[code];
  return code ? t.errors.invalid : t.errors.other;
}

export const OTHER_LISTINGS: Record<Lang, OtherListingsText> = {
  en: {
    title: "Your listings on other sites",
    lead: "Already on Nettimökki, Lomarengas, Mökkivuokra or another site? Add the links here. With the site's calendar link, those bookings close the dates everywhere Rantio lists your cottage.",
    url: "Listing address",
    calendar: "Calendar link (iCal)",
    calendarHint: "Optional. Many sites show it in their calendar settings, ending in .ics.",
    add: "Add listing",
    adding: "Adding…",
    remove: "Remove",
    open: "Open listing",
    addCalendar: "Add calendar link",
    save: "Save",
    cancel: "Cancel",
    none: "No listings on other sites yet.",
    nettimokki: "Nettimökki has no calendar link. Forward its booking emails to {address} and we close those dates everywhere.",
    lastRead: "Calendar read {time}",
    states: { none: "No calendar", pending: "Reading the calendar", connected: "Calendar connected", failed: "Calendar couldn't be read" },
    errors: {
      already_added: "That listing is already here.",
      too_many: "That's as many listings as one cottage can have.",
      https: "The address must start with https://",
      invalid: "That doesn't look like a web address. Copy it from your browser's address bar.",
      other: "Couldn't add it. Please try again in a moment.",
    },
  },
  fi: {
    title: "Ilmoituksesi muilla sivustoilla",
    lead: "Onko mökkisi jo Nettimökissä, Lomarenkaassa, Mökkivuokrassa tai muualla? Lisää linkit tähän. Kun lisäät sivuston kalenterilinkin, sen varaukset sulkevat päivät kaikkialla, missä Rantio ilmoittaa mökkisi.",
    url: "Ilmoituksen osoite",
    calendar: "Kalenterilinkki (iCal)",
    calendarHint: "Vapaaehtoinen. Monet sivustot näyttävät sen kalenterin asetuksissa, ja se päättyy .ics.",
    add: "Lisää ilmoitus",
    adding: "Lisätään…",
    remove: "Poista",
    open: "Avaa ilmoitus",
    addCalendar: "Lisää kalenterilinkki",
    save: "Tallenna",
    cancel: "Peru",
    none: "Ei vielä ilmoituksia muilla sivustoilla.",
    nettimokki: "Nettimökillä ei ole kalenterilinkkiä. Välitä sen varausviestit osoitteeseen {address}, niin suljemme ne päivät kaikkialla.",
    lastRead: "Kalenteri luettu {time}",
    states: { none: "Ei kalenteria", pending: "Kalenteria luetaan", connected: "Kalenteri yhdistetty", failed: "Kalenteria ei voitu lukea" },
    errors: {
      already_added: "Tämä ilmoitus on jo täällä.",
      too_many: "Yhdellä mökillä voi olla enintään näin monta ilmoitusta.",
      https: "Osoitteen pitää alkaa https://",
      invalid: "Tämä ei näytä verkko-osoitteelta. Kopioi se selaimen osoiteriviltä.",
      other: "Lisääminen ei onnistunut. Yritä hetken päästä uudelleen.",
    },
  },
  sv: {
    title: "Dina annonser på andra sajter",
    lead: "Finns stugan redan på Nettimökki, Lomarengas, Mökkivuokra eller någon annan sajt? Lägg till länkarna här. Med sajtens kalenderlänk stänger de bokningarna datumen överallt där Rantio annonserar din stuga.",
    url: "Annonsens adress",
    calendar: "Kalenderlänk (iCal)",
    calendarHint: "Valfritt. Många sajter visar den i kalenderinställningarna, och den slutar på .ics.",
    add: "Lägg till annons",
    adding: "Lägger till…",
    remove: "Ta bort",
    open: "Öppna annonsen",
    addCalendar: "Lägg till kalenderlänk",
    save: "Spara",
    cancel: "Avbryt",
    none: "Inga annonser på andra sajter än.",
    nettimokki: "Nettimökki har ingen kalenderlänk. Vidarebefordra bokningsmejlen därifrån till {address}, så stänger vi de datumen överallt.",
    lastRead: "Kalendern läst {time}",
    states: { none: "Ingen kalender", pending: "Kalendern läses", connected: "Kalendern ansluten", failed: "Kalendern kunde inte läsas" },
    errors: {
      already_added: "Den annonsen finns redan här.",
      too_many: "Fler annonser än så kan en stuga inte ha.",
      https: "Adressen måste börja med https://",
      invalid: "Det ser inte ut som en webbadress. Kopiera den från webbläsarens adressfält.",
      other: "Det gick inte att lägga till. Försök igen om en stund.",
    },
  },
  nb: {
    title: "Annonsene dine på andre nettsteder",
    lead: "Ligger hytta allerede på Nettimökki, Lomarengas, Mökkivuokra eller et annet nettsted? Legg til lenkene her. Med nettstedets kalenderlenke stenger de bookingene datoene overalt der Rantio annonserer hytta di.",
    url: "Annonsens adresse",
    calendar: "Kalenderlenke (iCal)",
    calendarHint: "Valgfritt. Mange nettsteder viser den i kalenderinnstillingene, og den slutter på .ics.",
    add: "Legg til annonse",
    adding: "Legger til…",
    remove: "Fjern",
    open: "Åpne annonsen",
    addCalendar: "Legg til kalenderlenke",
    save: "Lagre",
    cancel: "Avbryt",
    none: "Ingen annonser på andre nettsteder ennå.",
    nettimokki: "Nettimökki har ingen kalenderlenke. Videresend bookingmeldingene derfra til {address}, så stenger vi de datoene overalt.",
    lastRead: "Kalenderen lest {time}",
    states: { none: "Ingen kalender", pending: "Kalenderen leses", connected: "Kalenderen koblet til", failed: "Kalenderen kunne ikke leses" },
    errors: {
      already_added: "Den annonsen er allerede her.",
      too_many: "Flere annonser enn dette kan én hytte ikke ha.",
      https: "Adressen må begynne med https://",
      invalid: "Det ser ikke ut som en nettadresse. Kopier den fra adressefeltet i nettleseren.",
      other: "Kunne ikke legge den til. Prøv igjen om litt.",
    },
  },
  nn: {
    title: "Annonsane dine på andre nettstader",
    lead: "Ligg hytta allereie på Nettimökki, Lomarengas, Mökkivuokra eller ein annan nettstad? Legg til lenkjene her. Med kalenderlenkja til nettstaden stengjer dei bookingane datoane overalt der Rantio annonserer hytta di.",
    url: "Adressa til annonsen",
    calendar: "Kalenderlenkje (iCal)",
    calendarHint: "Valfritt. Mange nettstader viser ho i kalenderinnstillingane, og ho sluttar på .ics.",
    add: "Legg til annonse",
    adding: "Legg til…",
    remove: "Fjern",
    open: "Opne annonsen",
    addCalendar: "Legg til kalenderlenkje",
    save: "Lagre",
    cancel: "Avbryt",
    none: "Ingen annonsar på andre nettstader enno.",
    nettimokki: "Nettimökki har inga kalenderlenkje. Vidaresend bookingmeldingane derifrå til {address}, så stengjer vi dei datoane overalt.",
    lastRead: "Kalenderen lesen {time}",
    states: { none: "Ingen kalender", pending: "Kalenderen vert lesen", connected: "Kalenderen kopla til", failed: "Kalenderen kunne ikkje lesast" },
    errors: {
      already_added: "Den annonsen er allereie her.",
      too_many: "Fleire annonsar enn dette kan éi hytte ikkje ha.",
      https: "Adressa må byrje med https://",
      invalid: "Det ser ikkje ut som ei nettadresse. Kopier ho frå adressefeltet i nettlesaren.",
      other: "Kunne ikkje leggje ho til. Prøv igjen om litt.",
    },
  },
  da: {
    title: "Dine annoncer på andre sider",
    lead: "Ligger sommerhuset allerede på Nettimökki, Lomarengas, Mökkivuokra eller en anden side? Tilføj linkene her. Med sidens kalenderlink lukker de bookinger datoerne overalt, hvor Rantio annoncerer dit sommerhus.",
    url: "Annoncens adresse",
    calendar: "Kalenderlink (iCal)",
    calendarHint: "Valgfrit. Mange sider viser det i kalenderindstillingerne, og det ender på .ics.",
    add: "Tilføj annonce",
    adding: "Tilføjer…",
    remove: "Fjern",
    open: "Åbn annoncen",
    addCalendar: "Tilføj kalenderlink",
    save: "Gem",
    cancel: "Annuller",
    none: "Ingen annoncer på andre sider endnu.",
    nettimokki: "Nettimökki har intet kalenderlink. Videresend bookingmails derfra til {address}, så lukker vi de datoer overalt.",
    lastRead: "Kalenderen læst {time}",
    states: { none: "Ingen kalender", pending: "Kalenderen læses", connected: "Kalenderen forbundet", failed: "Kalenderen kunne ikke læses" },
    errors: {
      already_added: "Den annonce er her allerede.",
      too_many: "Flere annoncer end det kan ét sommerhus ikke have.",
      https: "Adressen skal starte med https://",
      invalid: "Det ligner ikke en webadresse. Kopiér den fra browserens adresselinje.",
      other: "Den kunne ikke tilføjes. Prøv igen om lidt.",
    },
  },
  is: {
    title: "Auglýsingar þínar á öðrum síðum",
    lead: "Er bústaðurinn þegar á Nettimökki, Lomarengas, Mökkivuokra eða annarri síðu? Bættu tenglunum við hér. Með dagatalstengli síðunnar loka bókanir þaðan dögunum alls staðar þar sem Rantio auglýsir bústaðinn þinn.",
    url: "Vefslóð auglýsingarinnar",
    calendar: "Dagatalstengill (iCal)",
    calendarHint: "Valfrjálst. Margar síður sýna hann í stillingum dagatalsins og hann endar á .ics.",
    add: "Bæta við auglýsingu",
    adding: "Bætir við…",
    remove: "Fjarlægja",
    open: "Opna auglýsinguna",
    addCalendar: "Bæta við dagatalstengli",
    save: "Vista",
    cancel: "Hætta við",
    none: "Engar auglýsingar á öðrum síðum enn.",
    nettimokki: "Nettimökki er ekki með dagatalstengil. Áframsendu bókunarpóstana þaðan á {address} og við lokum þeim dögum alls staðar.",
    lastRead: "Dagatal lesið {time}",
    states: { none: "Ekkert dagatal", pending: "Verið að lesa dagatalið", connected: "Dagatal tengt", failed: "Ekki tókst að lesa dagatalið" },
    errors: {
      already_added: "Þessi auglýsing er þegar hér.",
      too_many: "Einn bústaður getur ekki haft fleiri auglýsingar.",
      https: "Vefslóðin verður að byrja á https://",
      invalid: "Þetta lítur ekki út eins og vefslóð. Afritaðu hana úr veffangastiku vafrans.",
      other: "Ekki tókst að bæta henni við. Reyndu aftur eftir smástund.",
    },
  },
  et: {
    title: "Sinu kuulutused teistel saitidel",
    lead: "Kas su suvila on juba Nettimökkis, Lomarengases, Mökkivuokras või mõnel teisel saidil? Lisa lingid siia. Saidi kalendrilingiga sulgevad sealsed broneeringud kuupäevad kõikjal, kus Rantio su suvilat kuulutab.",
    url: "Kuulutuse aadress",
    calendar: "Kalendrilink (iCal)",
    calendarHint: "Valikuline. Paljud saidid näitavad seda kalendri seadetes ja see lõpeb .ics-iga.",
    add: "Lisa kuulutus",
    adding: "Lisan…",
    remove: "Eemalda",
    open: "Ava kuulutus",
    addCalendar: "Lisa kalendrilink",
    save: "Salvesta",
    cancel: "Loobu",
    none: "Teistel saitidel kuulutusi veel pole.",
    nettimokki: "Nettimökkil pole kalendrilinki. Edasta sealsed broneerimiskirjad aadressile {address} ja me sulgeme need kuupäevad kõikjal.",
    lastRead: "Kalender loetud {time}",
    states: { none: "Kalendrit pole", pending: "Kalendrit loetakse", connected: "Kalender ühendatud", failed: "Kalendrit ei õnnestunud lugeda" },
    errors: {
      already_added: "See kuulutus on juba siin.",
      too_many: "Ühel suvilal ei saa rohkem kuulutusi olla.",
      https: "Aadress peab algama https://",
      invalid: "See ei paista olevat veebiaadress. Kopeeri see brauseri aadressiribalt.",
      other: "Lisamine ei õnnestunud. Proovi hetke pärast uuesti.",
    },
  },
  lv: {
    title: "Jūsu sludinājumi citās vietnēs",
    lead: "Vai jūsu brīvdienu māja jau ir Nettimökki, Lomarengas, Mökkivuokra vai citā vietnē? Pievienojiet saites šeit. Ar vietnes kalendāra saiti tās rezervācijas slēdz datumus visur, kur Rantio publicē jūsu māju.",
    url: "Sludinājuma adrese",
    calendar: "Kalendāra saite (iCal)",
    calendarHint: "Nav obligāta. Daudzas vietnes to rāda kalendāra iestatījumos, un tā beidzas ar .ics.",
    add: "Pievienot sludinājumu",
    adding: "Pievieno…",
    remove: "Noņemt",
    open: "Atvērt sludinājumu",
    addCalendar: "Pievienot kalendāra saiti",
    save: "Saglabāt",
    cancel: "Atcelt",
    none: "Citās vietnēs sludinājumu vēl nav.",
    nettimokki: "Nettimökki nav kalendāra saites. Pārsūtiet tās rezervāciju e-pastus uz {address}, un mēs slēgsim šos datumus visur.",
    lastRead: "Kalendārs nolasīts {time}",
    states: { none: "Nav kalendāra", pending: "Kalendārs tiek nolasīts", connected: "Kalendārs pievienots", failed: "Kalendāru neizdevās nolasīt" },
    errors: {
      already_added: "Šis sludinājums jau ir šeit.",
      too_many: "Vienai mājai vairāk sludinājumu nevar būt.",
      https: "Adresei jāsākas ar https://",
      invalid: "Tas neizskatās pēc tīmekļa adreses. Nokopējiet to no pārlūka adreses joslas.",
      other: "Neizdevās pievienot. Lūdzu, mēģiniet vēlreiz pēc brīža.",
    },
  },
  lt: {
    title: "Jūsų skelbimai kitose svetainėse",
    lead: "Jūsų sodyba jau yra Nettimökki, Lomarengas, Mökkivuokra ar kitoje svetainėje? Pridėkite nuorodas čia. Su svetainės kalendoriaus nuoroda tos rezervacijos uždaro datas visur, kur Rantio skelbia jūsų sodybą.",
    url: "Skelbimo adresas",
    calendar: "Kalendoriaus nuoroda (iCal)",
    calendarHint: "Neprivaloma. Daugelis svetainių ją rodo kalendoriaus nustatymuose, ji baigiasi .ics.",
    add: "Pridėti skelbimą",
    adding: "Pridedama…",
    remove: "Pašalinti",
    open: "Atidaryti skelbimą",
    addCalendar: "Pridėti kalendoriaus nuorodą",
    save: "Išsaugoti",
    cancel: "Atšaukti",
    none: "Skelbimų kitose svetainėse dar nėra.",
    nettimokki: "Nettimökki neturi kalendoriaus nuorodos. Persiųskite iš ten gautus rezervacijų laiškus adresu {address}, ir mes uždarysime tas datas visur.",
    lastRead: "Kalendorius nuskaitytas {time}",
    states: { none: "Kalendoriaus nėra", pending: "Kalendorius skaitomas", connected: "Kalendorius prijungtas", failed: "Kalendoriaus nepavyko nuskaityti" },
    errors: {
      already_added: "Šis skelbimas jau yra čia.",
      too_many: "Viena sodyba daugiau skelbimų turėti negali.",
      https: "Adresas turi prasidėti https://",
      invalid: "Tai neatrodo kaip interneto adresas. Nukopijuokite jį iš naršyklės adreso juostos.",
      other: "Nepavyko pridėti. Bandykite dar kartą po akimirkos.",
    },
  },
  de: {
    title: "Deine Inserate auf anderen Seiten",
    lead: "Schon auf Nettimökki, Lomarengas, Mökkivuokra oder einer anderen Seite? Füge die Links hier hinzu. Mit dem Kalenderlink der Seite sperren diese Buchungen die Daten überall, wo Rantio dein Ferienhaus inseriert.",
    url: "Adresse des Inserats",
    calendar: "Kalenderlink (iCal)",
    calendarHint: "Optional. Viele Seiten zeigen ihn in den Kalendereinstellungen, er endet auf .ics.",
    add: "Inserat hinzufügen",
    adding: "Wird hinzugefügt…",
    remove: "Entfernen",
    open: "Inserat öffnen",
    addCalendar: "Kalenderlink hinzufügen",
    save: "Speichern",
    cancel: "Abbrechen",
    none: "Noch keine Inserate auf anderen Seiten.",
    nettimokki: "Nettimökki hat keinen Kalenderlink. Leite die Buchungs-E-Mails von dort an {address} weiter, dann sperren wir diese Daten überall.",
    lastRead: "Kalender gelesen: {time}",
    states: { none: "Kein Kalender", pending: "Kalender wird gelesen", connected: "Kalender verbunden", failed: "Kalender konnte nicht gelesen werden" },
    errors: {
      already_added: "Dieses Inserat ist schon hier.",
      too_many: "Mehr Inserate kann ein Ferienhaus nicht haben.",
      https: "Die Adresse muss mit https:// beginnen",
      invalid: "Das sieht nicht wie eine Webadresse aus. Kopiere sie aus der Adressleiste deines Browsers.",
      other: "Hinzufügen hat nicht geklappt. Bitte versuch es gleich noch einmal.",
    },
  },
};
