import type { Lang } from "../locales";

/** Cancellation policies (lib/cancellation.ts): the host's choice in the listing editor and
 *  apps, and what guests see on the cottage page and the booking link. */
export type CancellationText = {
  title: string;
  names: Record<"flexible" | "moderate" | "limited" | "firm", string>;
  /** The policy in one line, for hosts choosing and guests without dates. */
  rules: Record<"flexible" | "moderate" | "limited" | "firm", string>;
  /** What happens after the last refund date. */
  late: Record<"flexible" | "moderate" | "limited" | "firm", string>;
  /** Every policy: the 24 hours after booking. */
  window: string;
  /** With the guest's dates: {time} is the check-in time, {date} a day. */
  fullBefore: string;
  halfBefore: string;
  noDates: string;
  longTitle: string;
  longNames: Record<"firm" | "strict", string>;
  longRules: Record<"firm" | "strict", string>;
  /** Host side. */
  choose: string;
  nonRefundable: string;
  nonRefundableLead: string;
  sites: string;
  /** Guest side, on a cottage booked through the booking sites. */
  siteConfirms: string;
};

const en: CancellationText = {
  title: "Cancellation policy",
  names: { flexible: "Flexible", moderate: "Moderate", limited: "Limited", firm: "Firm" },
  rules: {
    flexible: "Full refund up to 1 day before check-in.",
    moderate: "Full refund up to 5 days before check-in.",
    limited: "Full refund up to 14 days before check-in, 50% refund up to 7 days before.",
    firm: "Full refund up to 30 days before check-in, 50% refund up to 7 days before.",
  },
  late: {
    flexible: "Cancel later and one night isn't refunded, nor are nights already stayed.",
    moderate: "Cancel later and one night plus half of the remaining nights aren't refunded.",
    limited: "Cancel less than 7 days before check-in and there's no refund.",
    firm: "Cancel less than 7 days before check-in and there's no refund.",
  },
  window: "Booked at least 7 days ahead? Free cancellation within 24 hours of booking.",
  fullBefore: "Free cancellation before {time} on {date}.",
  halfBefore: "Cancel before {time} on {date} for a 50% refund.",
  noDates: "Add your dates to see the exact dates for this stay.",
  longTitle: "Stays of 28 nights or more",
  longNames: { firm: "Firm", strict: "Strict" },
  longRules: {
    firm: "Full refund up to 30 days before check-in. Cancel later and the next 30 nights aren't refunded.",
    strict: "Full refund only within 48 hours of booking and at least 28 days before check-in. Cancel later and the next 30 nights aren't refunded.",
  },
  choose: "Choose how guests can cancel. You can change it at any time; a change applies to new bookings.",
  nonRefundable: "Non-refundable option",
  nonRefundableLead: "On the booking sites, guests can also choose a 10% lower price with no refund if they cancel.",
  sites: "Applies to bookings through your Rantio booking link. On each booking site we set its closest matching policy for you.",
  siteConfirms: "The booking site confirms these terms when you book.",
};

const fi: CancellationText = {
  title: "Peruutusehdot",
  names: { flexible: "Joustava", moderate: "Kohtuullinen", limited: "Rajoitettu", firm: "Tiukka" },
  rules: {
    flexible: "Täysi hyvitys, kun peruutat viimeistään 1 päivä ennen saapumista.",
    moderate: "Täysi hyvitys, kun peruutat viimeistään 5 päivää ennen saapumista.",
    limited: "Täysi hyvitys viimeistään 14 päivää ennen saapumista, 50 % hyvitys viimeistään 7 päivää ennen.",
    firm: "Täysi hyvitys viimeistään 30 päivää ennen saapumista, 50 % hyvitys viimeistään 7 päivää ennen.",
  },
  late: {
    flexible: "Myöhemmin peruttaessa yhtä yötä ei hyvitetä, eikä jo käytettyjä öitä.",
    moderate: "Myöhemmin peruttaessa yhtä yötä ja puolta jäljellä olevista öistä ei hyvitetä.",
    limited: "Alle 7 päivää ennen saapumista peruttaessa hyvitystä ei saa.",
    firm: "Alle 7 päivää ennen saapumista peruttaessa hyvitystä ei saa.",
  },
  window: "Varasitko vähintään 7 päivää etukäteen? Maksuton peruutus 24 tunnin sisällä varauksesta.",
  fullBefore: "Maksuton peruutus {date} klo {time} asti.",
  halfBefore: "Peruuta {date} klo {time} mennessä, niin saat 50 % hyvityksen.",
  noDates: "Lisää päivät, niin näet tämän vierailun tarkat päivämäärät.",
  longTitle: "Vähintään 28 yön vierailut",
  longNames: { firm: "Tiukka", strict: "Erittäin tiukka" },
  longRules: {
    firm: "Täysi hyvitys viimeistään 30 päivää ennen saapumista. Myöhemmin peruttaessa seuraavia 30 yötä ei hyvitetä.",
    strict: "Täysi hyvitys vain 48 tunnin sisällä varauksesta ja vähintään 28 päivää ennen saapumista. Myöhemmin peruttaessa seuraavia 30 yötä ei hyvitetä.",
  },
  choose: "Valitse, miten vieraat voivat peruuttaa. Voit muuttaa valintaa milloin tahansa; muutos koskee uusia varauksia.",
  nonRefundable: "Ei-hyvitettävä vaihtoehto",
  nonRefundableLead: "Varaussivustoilla vieraat voivat valita myös 10 % edullisemman hinnan, jota ei hyvitetä peruttaessa.",
  sites: "Koskee Rantio-varauslinkkisi kautta tehtyjä varauksia. Jokaiselle varaussivustolle asetamme puolestasi lähimmän vastaavan ehdon.",
  siteConfirms: "Varaussivusto vahvistaa ehdot, kun varaat.",
};

const sv: CancellationText = {
  title: "Avbokningsregler",
  names: { flexible: "Flexibel", moderate: "Måttlig", limited: "Begränsad", firm: "Fast" },
  rules: {
    flexible: "Full återbetalning fram till 1 dag före ankomst.",
    moderate: "Full återbetalning fram till 5 dagar före ankomst.",
    limited: "Full återbetalning fram till 14 dagar före ankomst, 50 % återbetalning fram till 7 dagar före.",
    firm: "Full återbetalning fram till 30 dagar före ankomst, 50 % återbetalning fram till 7 dagar före.",
  },
  late: {
    flexible: "Avbokar du senare får du inte tillbaka pengarna för en natt eller för nätter du redan har bott.",
    moderate: "Avbokar du senare får du inte tillbaka pengarna för en natt plus hälften av de återstående nätterna.",
    limited: "Avbokar du mindre än 7 dagar före ankomst blir det ingen återbetalning.",
    firm: "Avbokar du mindre än 7 dagar före ankomst blir det ingen återbetalning.",
  },
  window: "Bokade du minst 7 dagar i förväg? Gratis avbokning inom 24 timmar efter bokningen.",
  fullBefore: "Gratis avbokning före kl. {time} den {date}.",
  halfBefore: "Avboka före kl. {time} den {date} så får du 50 % tillbaka.",
  noDates: "Lägg till datum så ser du de exakta datumen för vistelsen.",
  longTitle: "Vistelser på 28 nätter eller mer",
  longNames: { firm: "Fast", strict: "Strikt" },
  longRules: {
    firm: "Full återbetalning fram till 30 dagar före ankomst. Avbokar du senare får du inte tillbaka pengarna för de följande 30 nätterna.",
    strict: "Full återbetalning endast inom 48 timmar efter bokningen och minst 28 dagar före ankomst. Avbokar du senare får du inte tillbaka pengarna för de följande 30 nätterna.",
  },
  choose: "Välj hur gäster kan avboka. Du kan ändra det när som helst; en ändring gäller nya bokningar.",
  nonRefundable: "Alternativ utan återbetalning",
  nonRefundableLead: "På bokningssajterna kan gäster också välja ett 10 % lägre pris utan återbetalning vid avbokning.",
  sites: "Gäller bokningar via din bokningslänk från Rantio. På varje bokningssajt väljer vi åt dig den regel som stämmer bäst.",
  siteConfirms: "Bokningssajten bekräftar villkoren när du bokar.",
};

const nb: CancellationText = {
  title: "Avbestillingsregler",
  names: { flexible: "Fleksibel", moderate: "Moderat", limited: "Begrenset", firm: "Fast" },
  rules: {
    flexible: "Full refusjon frem til 1 dag før ankomst.",
    moderate: "Full refusjon frem til 5 dager før ankomst.",
    limited: "Full refusjon frem til 14 dager før ankomst, 50 % refusjon frem til 7 dager før.",
    firm: "Full refusjon frem til 30 dager før ankomst, 50 % refusjon frem til 7 dager før.",
  },
  late: {
    flexible: "Avbestiller du senere, får du ikke refusjon for én natt eller for netter du allerede har bodd.",
    moderate: "Avbestiller du senere, får du ikke refusjon for én natt pluss halvparten av de gjenværende nettene.",
    limited: "Avbestiller du mindre enn 7 dager før ankomst, får du ingen refusjon.",
    firm: "Avbestiller du mindre enn 7 dager før ankomst, får du ingen refusjon.",
  },
  window: "Bestilte du minst 7 dager i forveien? Gratis avbestilling innen 24 timer etter bestillingen.",
  fullBefore: "Gratis avbestilling før kl. {time} den {date}.",
  halfBefore: "Avbestill før kl. {time} den {date}, så får du 50 % refusjon.",
  noDates: "Legg til datoer, så ser du de nøyaktige datoene for dette oppholdet.",
  longTitle: "Opphold på 28 netter eller mer",
  longNames: { firm: "Fast", strict: "Streng" },
  longRules: {
    firm: "Full refusjon frem til 30 dager før ankomst. Avbestiller du senere, får du ikke refusjon for de neste 30 nettene.",
    strict: "Full refusjon bare innen 48 timer etter bestillingen og minst 28 dager før ankomst. Avbestiller du senere, får du ikke refusjon for de neste 30 nettene.",
  },
  choose: "Velg hvordan gjester kan avbestille. Du kan endre det når som helst; en endring gjelder nye bestillinger.",
  nonRefundable: "Alternativ uten refusjon",
  nonRefundableLead: "På bookingsidene kan gjester også velge en 10 % lavere pris uten refusjon ved avbestilling.",
  sites: "Gjelder bestillinger via bookinglenken din fra Rantio. På hver bookingside velger vi den nærmeste tilsvarende regelen for deg.",
  siteConfirms: "Bookingsiden bekrefter vilkårene når du bestiller.",
};

const nn: CancellationText = {
  title: "Avbestillingsreglar",
  names: { flexible: "Fleksibel", moderate: "Moderat", limited: "Avgrensa", firm: "Fast" },
  rules: {
    flexible: "Full refusjon fram til 1 dag før du kjem.",
    moderate: "Full refusjon fram til 5 dagar før du kjem.",
    limited: "Full refusjon fram til 14 dagar før du kjem, 50 % refusjon fram til 7 dagar før.",
    firm: "Full refusjon fram til 30 dagar før du kjem, 50 % refusjon fram til 7 dagar før.",
  },
  late: {
    flexible: "Avbestiller du seinare, får du ikkje refusjon for éin natt eller for netter du alt har budd.",
    moderate: "Avbestiller du seinare, får du ikkje refusjon for éin natt pluss halvparten av dei resterande nettene.",
    limited: "Avbestiller du mindre enn 7 dagar før du kjem, får du inga refusjon.",
    firm: "Avbestiller du mindre enn 7 dagar før du kjem, får du inga refusjon.",
  },
  window: "Bestilte du minst 7 dagar på førehand? Gratis avbestilling innan 24 timar etter bestillinga.",
  fullBefore: "Gratis avbestilling før kl. {time} den {date}.",
  halfBefore: "Avbestill før kl. {time} den {date}, så får du 50 % refusjon.",
  noDates: "Legg til datoar, så ser du dei nøyaktige datoane for dette opphaldet.",
  longTitle: "Opphald på 28 netter eller meir",
  longNames: { firm: "Fast", strict: "Streng" },
  longRules: {
    firm: "Full refusjon fram til 30 dagar før du kjem. Avbestiller du seinare, får du ikkje refusjon for dei neste 30 nettene.",
    strict: "Full refusjon berre innan 48 timar etter bestillinga og minst 28 dagar før du kjem. Avbestiller du seinare, får du ikkje refusjon for dei neste 30 nettene.",
  },
  choose: "Vel korleis gjestar kan avbestille. Du kan endre det når som helst; ei endring gjeld nye bestillingar.",
  nonRefundable: "Alternativ utan refusjon",
  nonRefundableLead: "På bookingsidene kan gjestar også velje ein 10 % lågare pris utan refusjon ved avbestilling.",
  sites: "Gjeld bestillingar via bookinglenkja di frå Rantio. På kvar bookingside vel vi den nærmaste tilsvarande regelen for deg.",
  siteConfirms: "Bookingsida stadfestar vilkåra når du bestiller.",
};

const da: CancellationText = {
  title: "Afbestillingsregler",
  names: { flexible: "Fleksibel", moderate: "Moderat", limited: "Begrænset", firm: "Fast" },
  rules: {
    flexible: "Fuld refusion indtil 1 dag før ankomst.",
    moderate: "Fuld refusion indtil 5 dage før ankomst.",
    limited: "Fuld refusion indtil 14 dage før ankomst, 50 % refusion indtil 7 dage før.",
    firm: "Fuld refusion indtil 30 dage før ankomst, 50 % refusion indtil 7 dage før.",
  },
  late: {
    flexible: "Afbestiller du senere, får du ikke refunderet én nat eller nætter, du allerede har boet.",
    moderate: "Afbestiller du senere, får du ikke refunderet én nat plus halvdelen af de resterende nætter.",
    limited: "Afbestiller du mindre end 7 dage før ankomst, får du ingen refusion.",
    firm: "Afbestiller du mindre end 7 dage før ankomst, får du ingen refusion.",
  },
  window: "Har du booket mindst 7 dage i forvejen? Gratis afbestilling inden for 24 timer efter bookingen.",
  fullBefore: "Gratis afbestilling før kl. {time} den {date}.",
  halfBefore: "Afbestil før kl. {time} den {date}, så får du 50 % refunderet.",
  noDates: "Tilføj dine datoer for at se de præcise datoer for dette ophold.",
  longTitle: "Ophold på 28 nætter eller mere",
  longNames: { firm: "Fast", strict: "Streng" },
  longRules: {
    firm: "Fuld refusion indtil 30 dage før ankomst. Afbestiller du senere, får du ikke refunderet de næste 30 nætter.",
    strict: "Fuld refusion kun inden for 48 timer efter bookingen og mindst 28 dage før ankomst. Afbestiller du senere, får du ikke refunderet de næste 30 nætter.",
  },
  choose: "Vælg, hvordan gæster kan afbestille. Du kan ændre det når som helst; en ændring gælder nye bookinger.",
  nonRefundable: "Mulighed uden refusion",
  nonRefundableLead: "På bookingsiderne kan gæster også vælge en 10 % lavere pris uden refusion ved afbestilling.",
  sites: "Gælder bookinger via dit bookinglink fra Rantio. På hver bookingside vælger vi den nærmeste tilsvarende regel for dig.",
  siteConfirms: "Bookingsiden bekræfter vilkårene, når du booker.",
};

const is: CancellationText = {
  title: "Afbókunarregla",
  names: { flexible: "Sveigjanleg", moderate: "Hófleg", limited: "Takmörkuð", firm: "Föst" },
  rules: {
    flexible: "Full endurgreiðsla allt að 1 degi fyrir komu.",
    moderate: "Full endurgreiðsla allt að 5 dögum fyrir komu.",
    limited: "Full endurgreiðsla allt að 14 dögum fyrir komu, 50 % endurgreiðsla allt að 7 dögum fyrir.",
    firm: "Full endurgreiðsla allt að 30 dögum fyrir komu, 50 % endurgreiðsla allt að 7 dögum fyrir.",
  },
  late: {
    flexible: "Ef þú afbókar síðar er ein nótt ekki endurgreidd og ekki heldur nætur sem þú hefur þegar dvalið.",
    moderate: "Ef þú afbókar síðar eru ein nótt og helmingur nóttanna sem eftir eru ekki endurgreidd.",
    limited: "Ef þú afbókar minna en 7 dögum fyrir komu færðu enga endurgreiðslu.",
    firm: "Ef þú afbókar minna en 7 dögum fyrir komu færðu enga endurgreiðslu.",
  },
  window: "Bókaðir þú minnst 7 dögum fyrir fram? Ókeypis afbókun innan 24 klukkustunda frá bókun.",
  fullBefore: "Ókeypis afbókun fyrir kl. {time} þann {date}.",
  halfBefore: "Afbókaðu fyrir kl. {time} þann {date} til að fá 50 % endurgreiðslu.",
  noDates: "Bættu við dagsetningum til að sjá nákvæmar dagsetningar fyrir þessa dvöl.",
  longTitle: "Dvöl í 28 nætur eða lengur",
  longNames: { firm: "Föst", strict: "Ströng" },
  longRules: {
    firm: "Full endurgreiðsla allt að 30 dögum fyrir komu. Ef þú afbókar síðar eru næstu 30 nætur ekki endurgreiddar.",
    strict: "Full endurgreiðsla aðeins innan 48 klukkustunda frá bókun og minnst 28 dögum fyrir komu. Ef þú afbókar síðar eru næstu 30 nætur ekki endurgreiddar.",
  },
  choose: "Veldu hvernig gestir geta afbókað. Þú getur breytt þessu hvenær sem er; breyting gildir um nýjar bókanir.",
  nonRefundable: "Valkostur án endurgreiðslu",
  nonRefundableLead: "Á bókunarsíðunum geta gestir líka valið 10 % lægra verð án endurgreiðslu ef þeir afbóka.",
  sites: "Gildir um bókanir í gegnum Rantio-bókunartengilinn þinn. Á hverri bókunarsíðu stillum við fyrir þig þá reglu sem kemst næst.",
  siteConfirms: "Bókunarsíðan staðfestir þessa skilmála þegar þú bókar.",
};

const et: CancellationText = {
  title: "Tühistamistingimused",
  names: { flexible: "Paindlik", moderate: "Mõõdukas", limited: "Piiratud", firm: "Kindel" },
  rules: {
    flexible: "Täielik tagasimakse kuni 1 päev enne saabumist.",
    moderate: "Täielik tagasimakse kuni 5 päeva enne saabumist.",
    limited: "Täielik tagasimakse kuni 14 päeva enne saabumist, 50 % tagasimakse kuni 7 päeva enne.",
    firm: "Täielik tagasimakse kuni 30 päeva enne saabumist, 50 % tagasimakse kuni 7 päeva enne.",
  },
  late: {
    flexible: "Hiljem tühistades ei hüvitata ühte ööd ega juba veedetud öid.",
    moderate: "Hiljem tühistades ei hüvitata ühte ööd ega poolt ülejäänud öödest.",
    limited: "Vähem kui 7 päeva enne saabumist tühistades tagasimakset ei ole.",
    firm: "Vähem kui 7 päeva enne saabumist tühistades tagasimakset ei ole.",
  },
  window: "Broneerisid vähemalt 7 päeva ette? Tasuta tühistamine 24 tunni jooksul pärast broneerimist.",
  fullBefore: "Tasuta tühistamine enne {date} kell {time}.",
  halfBefore: "Tühista enne {date} kell {time}, et saada 50 % tagasi.",
  noDates: "Lisa kuupäevad, et näha selle reisi täpseid kuupäevi.",
  longTitle: "Viibimine 28 ööd või kauem",
  longNames: { firm: "Kindel", strict: "Range" },
  longRules: {
    firm: "Täielik tagasimakse kuni 30 päeva enne saabumist. Hiljem tühistades ei hüvitata järgmist 30 ööd.",
    strict: "Täielik tagasimakse ainult 48 tunni jooksul pärast broneerimist ja vähemalt 28 päeva enne saabumist. Hiljem tühistades ei hüvitata järgmist 30 ööd.",
  },
  choose: "Vali, kuidas külalised saavad tühistada. Saad seda igal ajal muuta; muudatus kehtib uutele broneeringutele.",
  nonRefundable: "Tagastamatu valik",
  nonRefundableLead: "Broneerimissaitidel saavad külalised valida ka 10 % madalama hinna, mida tühistamisel ei hüvitata.",
  sites: "Kehtib sinu Rantio broneerimislingi kaudu tehtud broneeringutele. Igal broneerimissaidil seame sinu eest sisse kõige lähedasemad tingimused.",
  siteConfirms: "Broneerimissait kinnitab need tingimused broneerimisel.",
};

const lv: CancellationText = {
  title: "Atcelšanas politika",
  names: { flexible: "Elastīga", moderate: "Mērena", limited: "Ierobežota", firm: "Stingra" },
  rules: {
    flexible: "Pilna atmaksa līdz 1 dienai pirms ierašanās.",
    moderate: "Pilna atmaksa līdz 5 dienām pirms ierašanās.",
    limited: "Pilna atmaksa līdz 14 dienām pirms ierašanās, 50 % atmaksa līdz 7 dienām pirms.",
    firm: "Pilna atmaksa līdz 30 dienām pirms ierašanās, 50 % atmaksa līdz 7 dienām pirms.",
  },
  late: {
    flexible: "Ja atceļat vēlāk, netiek atmaksāta viena nakts, kā arī jau pavadītās naktis.",
    moderate: "Ja atceļat vēlāk, netiek atmaksāta viena nakts un puse no atlikušajām naktīm.",
    limited: "Ja atceļat mazāk nekā 7 dienas pirms ierašanās, atmaksa netiek veikta.",
    firm: "Ja atceļat mazāk nekā 7 dienas pirms ierašanās, atmaksa netiek veikta.",
  },
  window: "Rezervējāt vismaz 7 dienas iepriekš? Bezmaksas atcelšana 24 stundu laikā pēc rezervēšanas.",
  fullBefore: "Bezmaksas atcelšana līdz {date} plkst. {time}.",
  halfBefore: "Atceliet līdz {date} plkst. {time}, lai saņemtu 50 % atmaksu.",
  noDates: "Pievienojiet datumus, lai redzētu precīzus datumus šai uzturēšanās reizei.",
  longTitle: "Uzturēšanās 28 naktis vai ilgāk",
  longNames: { firm: "Stingra", strict: "Ļoti stingra" },
  longRules: {
    firm: "Pilna atmaksa līdz 30 dienām pirms ierašanās. Ja atceļat vēlāk, nākamās 30 naktis netiek atmaksātas.",
    strict: "Pilna atmaksa tikai 48 stundu laikā pēc rezervēšanas un vismaz 28 dienas pirms ierašanās. Ja atceļat vēlāk, nākamās 30 naktis netiek atmaksātas.",
  },
  choose: "Izvēlieties, kā viesi var atcelt rezervāciju. To var mainīt jebkurā laikā; izmaiņas attiecas uz jaunām rezervācijām.",
  nonRefundable: "Neatmaksājama iespēja",
  nonRefundableLead: "Rezervēšanas vietnēs viesi var izvēlēties arī par 10 % zemāku cenu bez atmaksas atcelšanas gadījumā.",
  sites: "Attiecas uz rezervācijām, kas veiktas, izmantojot jūsu Rantio rezervēšanas saiti. Katrā rezervēšanas vietnē mēs jūsu vietā iestatām tuvāko atbilstošo politiku.",
  siteConfirms: "Rezervēšanas vietne apstiprina šos noteikumus, kad rezervējat.",
};

const lt: CancellationText = {
  title: "Atšaukimo politika",
  names: { flexible: "Lanksti", moderate: "Vidutinė", limited: "Ribota", firm: "Griežta" },
  rules: {
    flexible: "Visa suma grąžinama likus ne mažiau kaip 1 dienai iki atvykimo.",
    moderate: "Visa suma grąžinama likus ne mažiau kaip 5 dienoms iki atvykimo.",
    limited: "Visa suma grąžinama likus ne mažiau kaip 14 dienų iki atvykimo, 50 % – likus ne mažiau kaip 7 dienoms.",
    firm: "Visa suma grąžinama likus ne mažiau kaip 30 dienų iki atvykimo, 50 % – likus ne mažiau kaip 7 dienoms.",
  },
  late: {
    flexible: "Jei atšauksite vėliau, už vieną naktį ir jau praleistas naktis pinigai negrąžinami.",
    moderate: "Jei atšauksite vėliau, už vieną naktį ir pusę likusių naktų pinigai negrąžinami.",
    limited: "Jei atšauksite likus mažiau nei 7 dienoms iki atvykimo, pinigai negrąžinami.",
    firm: "Jei atšauksite likus mažiau nei 7 dienoms iki atvykimo, pinigai negrąžinami.",
  },
  window: "Užsisakėte bent prieš 7 dienas? Nemokamas atšaukimas per 24 valandas nuo užsakymo.",
  fullBefore: "Nemokamas atšaukimas iki {date} {time}.",
  halfBefore: "Atšaukite iki {date} {time} ir susigrąžinkite 50 %.",
  noDates: "Įrašykite datas ir pamatysite tikslias šios viešnagės datas.",
  longTitle: "28 naktų ir ilgesnės viešnagės",
  longNames: { firm: "Griežta", strict: "Labai griežta" },
  longRules: {
    firm: "Visa suma grąžinama likus ne mažiau kaip 30 dienų iki atvykimo. Jei atšauksite vėliau, už kitas 30 naktų pinigai negrąžinami.",
    strict: "Visa suma grąžinama tik per 48 valandas nuo užsakymo ir likus ne mažiau kaip 28 dienoms iki atvykimo. Jei atšauksite vėliau, už kitas 30 naktų pinigai negrąžinami.",
  },
  choose: "Pasirinkite, kaip svečiai gali atšaukti užsakymą. Galite tai pakeisti bet kada; pakeitimas taikomas naujiems užsakymams.",
  nonRefundable: "Negrąžinamo mokėjimo parinktis",
  nonRefundableLead: "Užsakymų svetainėse svečiai taip pat gali pasirinkti 10 % mažesnę kainą, kuri atšaukus negrąžinama.",
  sites: "Taikoma užsakymams per jūsų Rantio užsakymo nuorodą. Kiekvienoje užsakymų svetainėje už jus nustatome artimiausią atitinkančią politiką.",
  siteConfirms: "Užsakymų svetainė patvirtina šias sąlygas, kai užsisakote.",
};

const de: CancellationText = {
  title: "Stornierungsbedingungen",
  names: { flexible: "Flexibel", moderate: "Moderat", limited: "Eingeschränkt", firm: "Fest" },
  rules: {
    flexible: "Volle Erstattung bis 1 Tag vor der Anreise.",
    moderate: "Volle Erstattung bis 5 Tage vor der Anreise.",
    limited: "Volle Erstattung bis 14 Tage vor der Anreise, 50 % Erstattung bis 7 Tage vorher.",
    firm: "Volle Erstattung bis 30 Tage vor der Anreise, 50 % Erstattung bis 7 Tage vorher.",
  },
  late: {
    flexible: "Stornierst du später, wird eine Nacht nicht erstattet, ebenso wenig bereits verbrachte Nächte.",
    moderate: "Stornierst du später, werden eine Nacht und die Hälfte der restlichen Nächte nicht erstattet.",
    limited: "Stornierst du weniger als 7 Tage vor der Anreise, gibt es keine Erstattung.",
    firm: "Stornierst du weniger als 7 Tage vor der Anreise, gibt es keine Erstattung.",
  },
  window: "Mindestens 7 Tage im Voraus gebucht? Kostenlose Stornierung innerhalb von 24 Stunden nach der Buchung.",
  fullBefore: "Kostenlose Stornierung vor dem {date} um {time} Uhr.",
  halfBefore: "Stornierst du vor dem {date} um {time} Uhr, erhältst du 50 % zurück.",
  noDates: "Gib deine Reisedaten ein, um die genauen Daten für diesen Aufenthalt zu sehen.",
  longTitle: "Aufenthalte ab 28 Nächten",
  longNames: { firm: "Fest", strict: "Streng" },
  longRules: {
    firm: "Volle Erstattung bis 30 Tage vor der Anreise. Stornierst du später, werden die nächsten 30 Nächte nicht erstattet.",
    strict: "Volle Erstattung nur innerhalb von 48 Stunden nach der Buchung und mindestens 28 Tage vor der Anreise. Stornierst du später, werden die nächsten 30 Nächte nicht erstattet.",
  },
  choose: "Wähle, wie Gäste stornieren können. Du kannst das jederzeit ändern; eine Änderung gilt für neue Buchungen.",
  nonRefundable: "Nicht erstattbare Option",
  nonRefundableLead: "Auf den Buchungsportalen können Gäste außerdem einen um 10 % günstigeren Preis ohne Erstattung bei Stornierung wählen.",
  sites: "Gilt für Buchungen über deinen Rantio-Buchungslink. Auf jedem Buchungsportal stellen wir für dich die Bedingungen ein, die am besten passen.",
  siteConfirms: "Das Buchungsportal bestätigt diese Bedingungen bei der Buchung.",
};

export const CANCELLATION: Record<Lang, CancellationText> = {
  en,
  fi,
  sv,
  nb,
  nn,
  da,
  is,
  et,
  lv,
  lt,
  de,
};
