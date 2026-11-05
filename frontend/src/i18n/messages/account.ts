import type { Lang } from "../locales";

/** Deleting one's account (the app's Profile and Menu). Kept apart so the languages sit side by side. */
export type AccountText = { delete: string; title: string; body: string; done: string; error: string };

export const ACCOUNT: Record<Lang, AccountText> = {
  en: {
    delete: "Delete account",
    title: "Delete your Rantio account?",
    body: "Your name, email and sign-in are removed for good. If you have cottages, they're taken off every booking site; their bookings and invoices are kept, as bookkeeping law requires.",
    done: "Your account has been deleted.",
    error: "Couldn't delete the account. Please try again, or write to info@rantio.fi.",
  },
  fi: {
    delete: "Poista tili",
    title: "Poistetaanko Rantio-tilisi?",
    body: "Nimesi, sähköpostisi ja kirjautumisesi poistetaan pysyvästi. Jos sinulla on mökkejä, ne poistetaan kaikilta varaussivustoilta; niiden varaukset ja laskut säilytetään kirjanpitolain mukaisesti.",
    done: "Tilisi on poistettu.",
    error: "Tilin poistaminen ei onnistunut. Yritä uudelleen tai kirjoita osoitteeseen info@rantio.fi.",
  },
  sv: {
    delete: "Radera konto",
    title: "Radera ditt Rantio-konto?",
    body: "Ditt namn, din e-post och din inloggning tas bort för gott. Har du stugor tas de bort från alla bokningssajter; deras bokningar och fakturor sparas, som bokföringslagen kräver.",
    done: "Ditt konto har raderats.",
    error: "Det gick inte att radera kontot. Försök igen eller skriv till info@rantio.fi.",
  },
  nb: {
    delete: "Slett konto",
    title: "Slette Rantio-kontoen din?",
    body: "Navnet, e-posten og innloggingen din fjernes for godt. Har du hytter, fjernes de fra alle bookingnettsteder; bestillingene og fakturaene deres beholdes, slik bokføringsloven krever.",
    done: "Kontoen din er slettet.",
    error: "Kunne ikke slette kontoen. Prøv igjen, eller skriv til info@rantio.fi.",
  },
  nn: {
    delete: "Slett konto",
    title: "Slette Rantio-kontoen din?",
    body: "Namnet, e-posten og innlogginga di blir fjerna for godt. Har du hytter, blir dei fjerna frå alle bookingnettstader; bestillingane og fakturaene deira blir tekne vare på, slik bokføringslova krev.",
    done: "Kontoen din er sletta.",
    error: "Kunne ikkje slette kontoen. Prøv igjen, eller skriv til info@rantio.fi.",
  },
  da: {
    delete: "Slet konto",
    title: "Slet din Rantio-konto?",
    body: "Dit navn, din e-mail og dit login fjernes for altid. Har du sommerhuse, fjernes de fra alle bookingsider; deres bookinger og fakturaer gemmes, som bogføringsloven kræver.",
    done: "Din konto er slettet.",
    error: "Kontoen kunne ikke slettes. Prøv igen, eller skriv til info@rantio.fi.",
  },
  is: {
    delete: "Eyða aðgangi",
    title: "Eyða Rantio-aðganginum þínum?",
    body: "Nafnið þitt, netfangið og innskráningin eru fjarlægð fyrir fullt og allt. Ef þú átt bústaði eru þeir teknir af öllum bókunarsíðum; bókanir þeirra og reikningar eru geymdir eins og bókhaldslög krefjast.",
    done: "Aðganginum þínum hefur verið eytt.",
    error: "Ekki tókst að eyða aðganginum. Reyndu aftur eða skrifaðu á info@rantio.fi.",
  },
  et: {
    delete: "Kustuta konto",
    title: "Kas kustutada sinu Rantio konto?",
    body: "Sinu nimi, e-post ja sisselogimine eemaldatakse jäädavalt. Kui sul on puhkemaju, eemaldatakse need kõigilt broneerimissaitidelt; nende broneeringud ja arved säilitatakse, nagu raamatupidamisseadus nõuab.",
    done: "Sinu konto on kustutatud.",
    error: "Kontot ei õnnestunud kustutada. Proovi uuesti või kirjuta aadressil info@rantio.fi.",
  },
  lv: {
    delete: "Dzēst kontu",
    title: "Vai dzēst jūsu Rantio kontu?",
    body: "Jūsu vārds, e-pasts un pieteikšanās tiks neatgriezeniski dzēsti. Ja jums ir mājas, tās tiks noņemtas no visām rezervāciju vietnēm; to rezervācijas un rēķini tiks saglabāti, kā to prasa grāmatvedības likums.",
    done: "Jūsu konts ir dzēsts.",
    error: "Kontu neizdevās dzēst. Mēģiniet vēlreiz vai rakstiet uz info@rantio.fi.",
  },
  lt: {
    delete: "Ištrinti paskyrą",
    title: "Ištrinti Jūsų Rantio paskyrą?",
    body: "Jūsų vardas, el. paštas ir prisijungimas bus ištrinti visam laikui. Jei turite namelių, jie bus pašalinti iš visų rezervavimo svetainių; jų rezervacijos ir sąskaitos bus saugomos, kaip reikalauja apskaitos įstatymas.",
    done: "Jūsų paskyra ištrinta.",
    error: "Paskyros ištrinti nepavyko. Bandykite dar kartą arba rašykite info@rantio.fi.",
  },
  de: {
    delete: "Konto löschen",
    title: "Dein Rantio-Konto löschen?",
    body: "Dein Name, deine E-Mail-Adresse und deine Anmeldung werden endgültig entfernt. Hast du Ferienhäuser, werden sie von allen Buchungsportalen genommen; ihre Buchungen und Rechnungen bleiben gespeichert, wie es das Buchführungsrecht verlangt.",
    done: "Dein Konto wurde gelöscht.",
    error: "Das Konto konnte nicht gelöscht werden. Versuch es noch einmal oder schreib an info@rantio.fi.",
  },
};
