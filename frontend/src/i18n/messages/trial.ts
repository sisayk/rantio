import type { Lang } from "../locales";

/** The free trial (3 months, then the yearly fee) and the photos and card step of the
 *  sign-up form: the website's hosts page and welcome page, and the app's form.
 *  Kept apart from the big message files so the 10 languages sit side by side. */
export type TrialText = {
  badge: string;
  priceNote: string;
  photos: string;
  photosHint: string;
  addPhotos: string;
  removePhoto: string;
  photosRequired: string;
  photoType: string;
  tooManyPhotos: string;
  photoBig: string;
  cardNote: string;
  submit: string;
  welcome: {
    title: string;
    lead: string;
    notSavedTitle: string;
    notSavedLead: string;
    retry: string;
    checking: string;
    failed: string;
    backToApp: string;
    home: string;
  };
  trialUntil: string;
  /** Where the cottage is listed now: owners not listed anywhere are welcome too. */
  listedOn: string;
  listedHint: string;
  listedOptions: Record<ListedOn, string>;
  scratchTitle: string;
  scratchBody: string;
  scratchPoints: string[];
};

export const LISTED_ON = ["nettimokki", "airbnb", "booking", "vrbo", "other", "none"] as const;
export type ListedOn = (typeof LISTED_ON)[number];

export const TRIAL_MONTHS = 3;
export const MAX_SIGNUP_PHOTOS = 10;

export const TRIAL: Record<Lang, TrialText> = {
  en: {
    badge: "First 3 months free",
    priceNote:
      "The first 3 months after your listing goes live are free: no yearly fee. You save a card when you sign up, and nothing is charged until the free months end.",
    photos: "Photos of your cottage",
    photosHint: "1–10 photos: outside, the rooms, the sauna, the view. Phone photos are fine.",
    addPhotos: "Add photos",
    removePhoto: "Remove photo",
    photosRequired: "Add at least one photo.",
    photoType: "Use JPG, PNG or WebP photos.",
    tooManyPhotos: "Up to 10 photos.",
    photoBig: "A photo can be at most 8 MB.",
    cardNote: "Next you'll save a card for the free trial. Nothing is charged now.",
    submit: "Continue to the free trial",
    welcome: {
      title: "Your free trial is set",
      lead: "{name}, your card is saved and nothing has been charged. Your 3 free months start when your cottage's listing goes live. We'll be in touch soon to set it up.",
      notSavedTitle: "Your card isn't saved yet",
      notSavedLead: "The free trial starts once you've saved a card. Nothing is charged for 3 months.",
      retry: "Save a card",
      checking: "Checking…",
      failed: "We couldn't check right now. Try again in a moment, or write to {email}.",
      backToApp: "Back to the Rantio app",
      home: "Back to Rantio",
    },
    trialUntil: "Free until {date}",
    listedOn: "Where is your cottage listed now?",
    listedHint: "Not listed anywhere yet? That's fine: we make the listings for you.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Somewhere else", none: "Nowhere yet" },
    scratchTitle: "Not listed anywhere yet? We start from scratch",
    scratchBody: "Many cottages have never been rented out online. Send us photos and a few details and we do the rest: we write the listings, set the prices with you and put your cottage on Airbnb, Booking.com and Vrbo.",
    scratchPoints: ["Listings written for you", "Prices set together with you", "One calendar for every site"],
  },
  fi: {
    badge: "3 ensimmäistä kuukautta maksutta",
    priceNote:
      "3 ensimmäistä kuukautta ilmoituksen julkaisusta ovat maksuttomia: ei vuosimaksua. Tallennat kortin rekisteröityessäsi, eikä mitään veloiteta ennen kuin maksuttomat kuukaudet päättyvät.",
    photos: "Kuvia mökistäsi",
    photosHint: "1–10 kuvaa: ulkoa, huoneista, saunasta ja maisemasta. Puhelimella otetut kuvat käyvät hyvin.",
    addPhotos: "Lisää kuvia",
    removePhoto: "Poista kuva",
    photosRequired: "Lisää vähintään yksi kuva.",
    photoType: "Käytä JPG-, PNG- tai WebP-kuvia.",
    tooManyPhotos: "Enintään 10 kuvaa.",
    photoBig: "Kuva voi olla enintään 8 Mt.",
    cardNote: "Seuraavaksi tallennat kortin maksutonta kokeilua varten. Mitään ei veloiteta nyt.",
    submit: "Jatka maksuttomaan kokeiluun",
    welcome: {
      title: "Maksuton kokeilusi on valmis",
      lead: "{name}, korttisi on tallennettu, eikä mitään ole veloitettu. 3 maksutonta kuukauttasi alkavat, kun mökkisi ilmoitus julkaistaan. Otamme pian yhteyttä ja sovitaan loput.",
      notSavedTitle: "Korttia ei ole vielä tallennettu",
      notSavedLead: "Maksuton kokeilu alkaa, kun olet tallentanut kortin. Mitään ei veloiteta 3 kuukauteen.",
      retry: "Tallenna kortti",
      checking: "Tarkistetaan…",
      failed: "Emme voineet tarkistaa tätä juuri nyt. Yritä hetken päästä uudelleen tai kirjoita osoitteeseen {email}.",
      backToApp: "Takaisin Rantio-sovellukseen",
      home: "Takaisin Rantioon",
    },
    trialUntil: "Maksuton {date} asti",
    listedOn: "Missä mökkisi on nyt ilmoitettuna?",
    listedHint: "Eikö vielä missään? Ei haittaa: teemme ilmoitukset puolestasi.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Muualla", none: "Ei vielä missään" },
    scratchTitle: "Eikö mökkisi ole vielä missään? Aloitetaan alusta",
    scratchBody: "Moni mökki ei ole koskaan ollut vuokralla verkossa. Lähetä meille kuvat ja muutama tieto, niin hoidamme loput: kirjoitamme ilmoitukset, sovimme hinnat kanssasi ja viemme mökkisi Airbnb:hen, Booking.comiin ja Vrboon.",
    scratchPoints: ["Ilmoitukset kirjoitetaan puolestasi", "Hinnat sovitaan yhdessä", "Yksi kalenteri kaikille sivustoille"],
  },
  sv: {
    badge: "De första 3 månaderna gratis",
    priceNote:
      "De första 3 månaderna efter att annonsen publicerats är gratis: ingen årsavgift. Du sparar ett kort när du anmäler dig, och inget dras förrän de gratis månaderna är slut.",
    photos: "Bilder på din stuga",
    photosHint: "1–10 bilder: utsidan, rummen, bastun, utsikten. Mobilbilder går bra.",
    addPhotos: "Lägg till bilder",
    removePhoto: "Ta bort bild",
    photosRequired: "Lägg till minst en bild.",
    photoType: "Använd JPG-, PNG- eller WebP-bilder.",
    tooManyPhotos: "Högst 10 bilder.",
    photoBig: "En bild får vara högst 8 MB.",
    cardNote: "Sedan sparar du ett kort för den kostnadsfria provperioden. Inget dras nu.",
    submit: "Fortsätt till provperioden",
    welcome: {
      title: "Din kostnadsfria provperiod är klar",
      lead: "{name}, ditt kort är sparat och inget har dragits. Dina 3 gratis månader börjar när stugans annons publiceras. Vi hör av oss snart för att ordna resten.",
      notSavedTitle: "Ditt kort är inte sparat än",
      notSavedLead: "Provperioden börjar när du har sparat ett kort. Inget dras på 3 månader.",
      retry: "Spara ett kort",
      checking: "Kontrollerar…",
      failed: "Vi kunde inte kontrollera det just nu. Försök igen om en stund eller skriv till {email}.",
      backToApp: "Tillbaka till Rantio-appen",
      home: "Tillbaka till Rantio",
    },
    trialUntil: "Gratis till {date}",
    listedOn: "Var finns din stuga annonserad nu?",
    listedHint: "Inte annonserad någonstans än? Inga problem: vi gör annonserna åt dig.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Någon annanstans", none: "Ingenstans än" },
    scratchTitle: "Inte annonserad någonstans än? Vi börjar från början",
    scratchBody: "Många stugor har aldrig hyrts ut på nätet. Skicka bilder och några uppgifter så gör vi resten: vi skriver annonserna, sätter priserna tillsammans med dig och lägger ut stugan på Airbnb, Booking.com och Vrbo.",
    scratchPoints: ["Annonserna skrivs åt dig", "Priserna sätts tillsammans med dig", "En kalender för alla sajter"],
  },
  nb: {
    badge: "De første 3 månedene gratis",
    priceNote:
      "De første 3 månedene etter at annonsen er publisert er gratis: ingen årsavgift. Du lagrer et kort når du melder deg på, og ingenting trekkes før de gratis månedene er over.",
    photos: "Bilder av hytta di",
    photosHint: "1–10 bilder: utsiden, rommene, badstuen, utsikten. Mobilbilder går fint.",
    addPhotos: "Legg til bilder",
    removePhoto: "Fjern bilde",
    photosRequired: "Legg til minst ett bilde.",
    photoType: "Bruk JPG-, PNG- eller WebP-bilder.",
    tooManyPhotos: "Opptil 10 bilder.",
    photoBig: "Et bilde kan være på høyst 8 MB.",
    cardNote: "Deretter lagrer du et kort for den gratis prøveperioden. Ingenting trekkes nå.",
    submit: "Gå videre til prøveperioden",
    welcome: {
      title: "Den gratis prøveperioden din er klar",
      lead: "{name}, kortet ditt er lagret, og ingenting er trukket. De 3 gratis månedene starter når hyttas annonse publiseres. Vi tar kontakt snart for å ordne resten.",
      notSavedTitle: "Kortet ditt er ikke lagret ennå",
      notSavedLead: "Prøveperioden starter når du har lagret et kort. Ingenting trekkes på 3 måneder.",
      retry: "Lagre et kort",
      checking: "Sjekker…",
      failed: "Vi kunne ikke sjekke det akkurat nå. Prøv igjen om litt, eller skriv til {email}.",
      backToApp: "Tilbake til Rantio-appen",
      home: "Tilbake til Rantio",
    },
    trialUntil: "Gratis til {date}",
    listedOn: "Hvor er hytta di annonsert nå?",
    listedHint: "Ikke annonsert noe sted ennå? Helt greit: vi lager annonsene for deg.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Et annet sted", none: "Ingen steder ennå" },
    scratchTitle: "Ikke annonsert noe sted ennå? Vi starter fra bunnen",
    scratchBody: "Mange hytter har aldri vært leid ut på nett. Send oss bilder og noen opplysninger, så gjør vi resten: vi skriver annonsene, setter prisene sammen med deg og legger ut hytta på Airbnb, Booking.com og Vrbo.",
    scratchPoints: ["Annonsene skrives for deg", "Prisene settes sammen med deg", "Én kalender for alle nettsteder"],
  },
  nn: {
    badge: "Dei første 3 månadene gratis",
    priceNote:
      "Dei første 3 månadene etter at annonsen er publisert er gratis: inga årsavgift. Du lagrar eit kort når du melder deg på, og ingenting blir trekt før dei gratis månadene er over.",
    photos: "Bilete av hytta di",
    photosHint: "1–10 bilete: utsida, romma, badstova, utsikta. Mobilbilete går fint.",
    addPhotos: "Legg til bilete",
    removePhoto: "Fjern bilete",
    photosRequired: "Legg til minst eitt bilete.",
    photoType: "Bruk JPG-, PNG- eller WebP-bilete.",
    tooManyPhotos: "Opptil 10 bilete.",
    photoBig: "Eit bilete kan vere på høgst 8 MB.",
    cardNote: "Deretter lagrar du eit kort for den gratis prøveperioden. Ingenting blir trekt no.",
    submit: "Gå vidare til prøveperioden",
    welcome: {
      title: "Den gratis prøveperioden din er klar",
      lead: "{name}, kortet ditt er lagra, og ingenting er trekt. Dei 3 gratis månadene byrjar når annonsen for hytta blir publisert. Vi tek kontakt snart for å ordne resten.",
      notSavedTitle: "Kortet ditt er ikkje lagra enno",
      notSavedLead: "Prøveperioden byrjar når du har lagra eit kort. Ingenting blir trekt på 3 månader.",
      retry: "Lagre eit kort",
      checking: "Sjekkar…",
      failed: "Vi kunne ikkje sjekke det akkurat no. Prøv igjen om litt, eller skriv til {email}.",
      backToApp: "Tilbake til Rantio-appen",
      home: "Tilbake til Rantio",
    },
    trialUntil: "Gratis til {date}",
    listedOn: "Kvar er hytta di annonsert no?",
    listedHint: "Ikkje annonsert nokon stad enno? Heilt greitt: vi lagar annonsane for deg.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Ein annan stad", none: "Ingen stad enno" },
    scratchTitle: "Ikkje annonsert nokon stad enno? Vi byrjar frå botnen",
    scratchBody: "Mange hytter har aldri vore leigde ut på nett. Send oss bilete og nokre opplysningar, så gjer vi resten: vi skriv annonsane, set prisane saman med deg og legg ut hytta på Airbnb, Booking.com og Vrbo.",
    scratchPoints: ["Annonsane blir skrivne for deg", "Prisane blir sette saman med deg", "Éin kalender for alle nettstader"],
  },
  da: {
    badge: "De første 3 måneder gratis",
    priceNote:
      "De første 3 måneder efter at din annonce er gået online, er gratis: intet årsgebyr. Du gemmer et kort, når du tilmelder dig, og der trækkes intet, før de gratis måneder er gået.",
    photos: "Billeder af dit sommerhus",
    photosHint: "1–10 billeder: udefra, værelserne, saunaen, udsigten. Mobilbilleder er fine.",
    addPhotos: "Tilføj billeder",
    removePhoto: "Fjern billede",
    photosRequired: "Tilføj mindst ét billede.",
    photoType: "Brug JPG-, PNG- eller WebP-billeder.",
    tooManyPhotos: "Op til 10 billeder.",
    photoBig: "Et billede må højst fylde 8 MB.",
    cardNote: "Derefter gemmer du et kort til den gratis prøveperiode. Der trækkes intet nu.",
    submit: "Fortsæt til prøveperioden",
    welcome: {
      title: "Din gratis prøveperiode er klar",
      lead: "{name}, dit kort er gemt, og der er ikke trukket noget. Dine 3 gratis måneder begynder, når sommerhusets annonce går online. Vi kontakter dig snart for at klare resten.",
      notSavedTitle: "Dit kort er ikke gemt endnu",
      notSavedLead: "Prøveperioden begynder, når du har gemt et kort. Der trækkes intet i 3 måneder.",
      retry: "Gem et kort",
      checking: "Tjekker…",
      failed: "Vi kunne ikke tjekke det lige nu. Prøv igen om lidt, eller skriv til {email}.",
      backToApp: "Tilbage til Rantio-appen",
      home: "Tilbage til Rantio",
    },
    trialUntil: "Gratis til {date}",
    listedOn: "Hvor er dit sommerhus annonceret nu?",
    listedHint: "Ikke annonceret nogen steder endnu? Helt fint: vi laver annoncerne for dig.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Et andet sted", none: "Ingen steder endnu" },
    scratchTitle: "Ikke annonceret nogen steder endnu? Vi starter fra bunden",
    scratchBody: "Mange sommerhuse har aldrig været lejet ud online. Send os billeder og et par oplysninger, så klarer vi resten: vi skriver annoncerne, fastsætter priserne sammen med dig og lægger sommerhuset på Airbnb, Booking.com og Vrbo.",
    scratchPoints: ["Annoncerne skrives for dig", "Priserne fastsættes sammen med dig", "Én kalender til alle sider"],
  },
  is: {
    badge: "Fyrstu 3 mánuðirnir ókeypis",
    priceNote:
      "Fyrstu 3 mánuðirnir eftir að auglýsingin fer í loftið eru ókeypis: ekkert árgjald. Þú vistar kort þegar þú skráir þig og ekkert er gjaldfært fyrr en ókeypis mánuðunum lýkur.",
    photos: "Myndir af bústaðnum",
    photosHint: "1–10 myndir: að utan, herbergin, gufubaðið, útsýnið. Símamyndir eru fínar.",
    addPhotos: "Bæta við myndum",
    removePhoto: "Fjarlægja mynd",
    photosRequired: "Bættu við að minnsta kosti einni mynd.",
    photoType: "Notaðu JPG-, PNG- eða WebP-myndir.",
    tooManyPhotos: "Mest 10 myndir.",
    photoBig: "Mynd má vera mest 8 MB.",
    cardNote: "Næst vistar þú kort fyrir ókeypis prufutímann. Ekkert er gjaldfært núna.",
    submit: "Áfram í ókeypis prufutíma",
    welcome: {
      title: "Ókeypis prufutíminn þinn er tilbúinn",
      lead: "{name}, kortið þitt er vistað og ekkert hefur verið gjaldfært. 3 ókeypis mánuðirnir hefjast þegar auglýsing bústaðarins fer í loftið. Við höfum samband fljótlega til að ganga frá restinni.",
      notSavedTitle: "Kortið þitt er ekki vistað enn",
      notSavedLead: "Prufutíminn hefst þegar þú hefur vistað kort. Ekkert er gjaldfært í 3 mánuði.",
      retry: "Vista kort",
      checking: "Athuga…",
      failed: "Við gátum ekki athugað þetta núna. Reyndu aftur eftir smástund eða skrifaðu á {email}.",
      backToApp: "Aftur í Rantio-appið",
      home: "Aftur á Rantio",
    },
    trialUntil: "Ókeypis til {date}",
    listedOn: "Hvar er bústaðurinn auglýstur núna?",
    listedHint: "Ekki auglýstur neins staðar enn? Ekkert mál: við gerum auglýsingarnar fyrir þig.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Annars staðar", none: "Hvergi enn" },
    scratchTitle: "Ekki auglýstur neins staðar enn? Við byrjum frá grunni",
    scratchBody: "Margir bústaðir hafa aldrei verið leigðir út á netinu. Sendu okkur myndir og nokkrar upplýsingar og við sjáum um restina: við skrifum auglýsingarnar, ákveðum verðin með þér og setjum bústaðinn á Airbnb, Booking.com og Vrbo.",
    scratchPoints: ["Auglýsingarnar skrifaðar fyrir þig", "Verðin ákveðin með þér", "Eitt dagatal fyrir allar síður"],
  },
  et: {
    badge: "Esimesed 3 kuud tasuta",
    priceNote:
      "Esimesed 3 kuud pärast kuulutuse avaldamist on tasuta: aastatasu ei ole. Salvestad registreerumisel kaardi ja midagi ei võeta enne, kui tasuta kuud on läbi.",
    photos: "Pildid sinu suvemajast",
    photosHint: "1–10 pilti: väljast, toad, saun, vaade. Telefoniga tehtud pildid sobivad.",
    addPhotos: "Lisa pilte",
    removePhoto: "Eemalda pilt",
    photosRequired: "Lisa vähemalt üks pilt.",
    photoType: "Kasuta JPG-, PNG- või WebP-pilte.",
    tooManyPhotos: "Kuni 10 pilti.",
    photoBig: "Pilt võib olla kuni 8 MB.",
    cardNote: "Järgmisena salvestad tasuta prooviaja jaoks kaardi. Praegu ei võeta midagi.",
    submit: "Jätka tasuta prooviajaga",
    welcome: {
      title: "Sinu tasuta prooviaeg on valmis",
      lead: "{name}, sinu kaart on salvestatud ja midagi pole võetud. Sinu 3 tasuta kuud algavad, kui suvemaja kuulutus avaldatakse. Võtame peagi ühendust, et ülejäänu kokku leppida.",
      notSavedTitle: "Sinu kaarti pole veel salvestatud",
      notSavedLead: "Prooviaeg algab, kui oled kaardi salvestanud. 3 kuu jooksul ei võeta midagi.",
      retry: "Salvesta kaart",
      checking: "Kontrollime…",
      failed: "Me ei saanud seda praegu kontrollida. Proovi hetke pärast uuesti või kirjuta aadressile {email}.",
      backToApp: "Tagasi Rantio rakendusse",
      home: "Tagasi Rantiosse",
    },
    trialUntil: "Tasuta kuni {date}",
    listedOn: "Kus on sinu suvemaja praegu kuulutatud?",
    listedHint: "Pole veel kusagil? Pole hullu: teeme kuulutused sinu eest.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Mujal", none: "Veel mitte kusagil" },
    scratchTitle: "Pole veel kusagil kuulutatud? Alustame algusest",
    scratchBody: "Paljusid suvemaju pole kunagi internetis välja üüritud. Saada meile pildid ja mõned andmed ning ülejäänu teeme meie: kirjutame kuulutused, lepime sinuga hinnad kokku ja paneme suvemaja Airbnb-sse, Booking.com-i ja Vrbo-sse.",
    scratchPoints: ["Kuulutused kirjutatakse sinu eest", "Hinnad lepitakse kokku koos sinuga", "Üks kalender kõigile saitidele"],
  },
  lv: {
    badge: "Pirmie 3 mēneši bez maksas",
    priceNote:
      "Pirmie 3 mēneši pēc sludinājuma publicēšanas ir bez maksas: nav gada maksas. Reģistrējoties jūs saglabājat karti, un nekas netiek iekasēts, līdz bezmaksas mēneši beidzas.",
    photos: "Jūsu mājas fotoattēli",
    photosHint: "1–10 fotoattēli: no ārpuses, istabas, pirts, skats. Ar tālruni uzņemti attēli der.",
    addPhotos: "Pievienot fotoattēlus",
    removePhoto: "Noņemt fotoattēlu",
    photosRequired: "Pievienojiet vismaz vienu fotoattēlu.",
    photoType: "Izmantojiet JPG, PNG vai WebP attēlus.",
    tooManyPhotos: "Ne vairāk kā 10 fotoattēli.",
    photoBig: "Attēls var būt ne lielāks par 8 MB.",
    cardNote: "Tālāk jūs saglabāsiet karti bezmaksas izmēģinājumam. Šobrīd nekas netiek iekasēts.",
    submit: "Turpināt uz bezmaksas izmēģinājumu",
    welcome: {
      title: "Jūsu bezmaksas izmēģinājums ir sagatavots",
      lead: "{name}, jūsu karte ir saglabāta, un nekas nav iekasēts. Jūsu 3 bezmaksas mēneši sākas, kad mājas sludinājums tiek publicēts. Drīz sazināsimies, lai vienotos par pārējo.",
      notSavedTitle: "Jūsu karte vēl nav saglabāta",
      notSavedLead: "Izmēģinājums sākas, kad esat saglabājis karti. 3 mēnešus nekas netiek iekasēts.",
      retry: "Saglabāt karti",
      checking: "Pārbaudām…",
      failed: "Šobrīd to nevarējām pārbaudīt. Mēģiniet vēlreiz pēc brīža vai rakstiet uz {email}.",
      backToApp: "Atpakaļ uz Rantio lietotni",
      home: "Atpakaļ uz Rantio",
    },
    trialUntil: "Bez maksas līdz {date}",
    listedOn: "Kur jūsu māja pašlaik ir izsludināta?",
    listedHint: "Vēl nekur nav izsludināta? Nekas: sludinājumus izveidosim mēs.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Citur", none: "Vēl nekur" },
    scratchTitle: "Vēl nekur nav izsludināta? Sāksim no nulles",
    scratchBody: "Daudzas mājas nekad nav izīrētas tiešsaistē. Atsūtiet mums fotoattēlus un dažas ziņas, un pārējo paveiksim mēs: uzrakstīsim sludinājumus, kopā ar jums noteiksim cenas un ievietosim māju Airbnb, Booking.com un Vrbo.",
    scratchPoints: ["Sludinājumus uzrakstām mēs", "Cenas nosakām kopā ar jums", "Viens kalendārs visām vietnēm"],
  },
  lt: {
    badge: "Pirmieji 3 mėnesiai nemokamai",
    priceNote:
      "Pirmieji 3 mėnesiai po skelbimo paskelbimo nemokami: metinio mokesčio nėra. Registruodamiesi išsaugote kortelę, ir niekas nenuskaičiuojama, kol nesibaigia nemokami mėnesiai.",
    photos: "Jūsų sodybos nuotraukos",
    photosHint: "1–10 nuotraukų: iš lauko, kambariai, pirtis, vaizdas. Telefonu darytos nuotraukos tinka.",
    addPhotos: "Pridėti nuotraukų",
    removePhoto: "Pašalinti nuotrauką",
    photosRequired: "Pridėkite bent vieną nuotrauką.",
    photoType: "Naudokite JPG, PNG arba WebP nuotraukas.",
    tooManyPhotos: "Ne daugiau kaip 10 nuotraukų.",
    photoBig: "Nuotrauka gali būti ne didesnė nei 8 MB.",
    cardNote: "Toliau išsaugosite kortelę nemokamam bandomajam laikotarpiui. Dabar niekas nenuskaičiuojama.",
    submit: "Tęsti į nemokamą bandomąjį laikotarpį",
    welcome: {
      title: "Jūsų nemokamas bandomasis laikotarpis paruoštas",
      lead: "{name}, jūsų kortelė išsaugota ir niekas nenuskaičiuota. Jūsų 3 nemokami mėnesiai prasideda, kai sodybos skelbimas paskelbiamas. Netrukus susisieksime ir susitarsime dėl likusių dalykų.",
      notSavedTitle: "Jūsų kortelė dar neišsaugota",
      notSavedLead: "Bandomasis laikotarpis prasideda, kai išsaugote kortelę. 3 mėnesius niekas nenuskaičiuojama.",
      retry: "Išsaugoti kortelę",
      checking: "Tikriname…",
      failed: "Šiuo metu negalėjome to patikrinti. Bandykite dar kartą po akimirkos arba rašykite adresu {email}.",
      backToApp: "Grįžti į Rantio programėlę",
      home: "Grįžti į Rantio",
    },
    trialUntil: "Nemokamai iki {date}",
    listedOn: "Kur jūsų sodyba dabar paskelbta?",
    listedHint: "Dar niekur nepaskelbta? Nieko tokio: skelbimus parengsime mes.",
    listedOptions: { nettimokki: "Nettimökki", airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", other: "Kitur", none: "Dar niekur" },
    scratchTitle: "Dar niekur nepaskelbta? Pradėsime nuo nulio",
    scratchBody: "Daugelis sodybų niekada nebuvo nuomojamos internetu. Atsiųskite nuotraukų ir kelias žinias, o likusį darbą atliksime mes: parašysime skelbimus, kartu su jumis nustatysime kainas ir paskelbsime sodybą Airbnb, Booking.com ir Vrbo.",
    scratchPoints: ["Skelbimus parašome mes", "Kainas nustatome kartu su jumis", "Vienas kalendorius visoms svetainėms"],
  },
};
