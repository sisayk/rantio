import { CONTACT_EMAIL } from "@/lib/content";
import type { LegalTexts } from ".";

const UPDATED = "Päivitetty viimeksi 6.11.2026";

export const fi: LegalTexts = {
  privacy: {
    title: "Tietosuojaseloste",
    description: "Miten Rantio käsittelee vieraiden, mökkien omistajien ja sivuston käyttäjien henkilötietoja.",
    updated: UPDATED,
    intro:
      "Tässä selosteessa kerromme, mitä henkilötietoja Rantio kerää, miksi, kuka niitä näkee ja mitä oikeuksia sinulla on. Keräämme niin vähän kuin pystymme ja säilytämme tiedot EU:ssa.",
    sections: [
      {
        heading: "Keitä olemme",
        paragraphs: [
          "Rantio on suomalaisen toiminimen Elda-Auto Tmi:n aputoiminimi (Y-tunnus 2565459-6, ALV-numero FI25654596). Elda-Auto Tmi on tässä kuvattujen henkilötietojen rekisterinpitäjä.",
          `Tietosuojaa koskevat kysymykset ja omia tietojasi koskevat pyynnöt: ${CONTACT_EMAIL}. Vastaamme kuukauden kuluessa, yleensä paljon nopeammin.`,
        ],
      },
      {
        heading: "Vieraat, jotka lähettävät kysymyksen omistajalle",
        paragraphs: [
          "Kun käytät mökin sivulla olevaa yhteydenottolomaketta, tallennamme kirjoittamasi viestin ja välitämme sen mökin omistajalle. Sähköpostiosoitteesi avulla lähetämme sinulle yksityisen linkin keskusteluun ja kerromme, kun omistaja vastaa. Kuka tahansa, jolla on linkki, voi lukea keskustelun, joten pidä se omana tietonasi.",
          "Käsittelyperuste: oikeutettu etumme toimittaa kysymys, jonka pyysit meitä välittämään, ja antaa omistajan vastata siihen (tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta).",
          "Mitä tallennamme:",
        ],
        list: [
          "Nimesi ja sähköpostiosoitteesi",
          "Päivät ja henkilömäärän, jos kerrot ne",
          "Viestisi ja omistajan vastaukset",
          "Sivuston kielen, jotta voimme kirjoittaa sinulle sillä",
        ],
      },
      {
        heading: "Mökkien omistajat",
        paragraphs: [
          "Kun ilmoittaudut, tallennamme lomakkeen tiedot ja kuvat, jotta voimme ottaa sinuun yhteyttä ja tehdä ilmoituksesi. Maksutonta kokeilua varten tallennat sen jälkeen kortin Stripen sivulla: Stripe säilyttää kortin, ja me saamme tietää vain, että kortti on tallennettu. Jos sinusta tulee asiakas, säilytämme myös tilisi, mökkisi, varaukset, maksut ja laskut. Kirjaudut sisään sähköpostiisi tai puhelimeesi lähetettävällä kertakäyttöisellä koodilla. Koodi vanhenee 15 minuutissa, ja tallennamme sen vain salattuna (tiivisteenä). Jos kirjaudut Googlella tai Applella, ne kertovat meille tilisi tunnisteen ja sähköpostiosoitteen, joita käytämme vain tunnistaaksemme sinut.",
          "Käsittelyperuste: pyytämäsi toimet ennen sopimusta ja ilmoittautumislomakkeella antamasi suostumus (6 artiklan 1 kohdan b ja a alakohta), omistajan palvelusopimuksen toteuttaminen (b alakohta) sekä kirjanpitolain edellyttämien tositteiden säilyttäminen (c alakohta).",
          "Mitä tallennamme:",
        ],
        list: [
          "Nimesi, sähköpostiosoitteesi ja puhelinnumerosi, jos annat sen",
          "Ilmoittautumislomakkeen maan, alueen, paikkakunnan, mökkien määrän, Nettimökki-linkin ja viestin",
          "Mökkiesi kuvaukset, kuvat, hinnat ja kalenterit",
          "Varaukset, vuosimaksut, provisiot, laskut ja niiden maksutilanteen (maksut kulkevat Stripen kautta, emmekä koskaan näe tai tallenna korttinumeroita)",
          "Viestisi vieraiden ja meidän kanssamme",
        ],
      },
      {
        heading: "Rantio-sovellus",
        paragraphs: [
          "Rantio-sovellus iPhonelle ja Androidille käyttää samaa tiliä kuin sivusto. Kun kirjaudut, sovellus saa oman kirjautumisavaimen ja säilyttää sen puhelimen suojatussa tallennustilassa (iPhonen avainnipussa tai Androidin Keystoressa). Me tallennamme siitä vain salatun (tiivistetyn) version puhelimen mallinimen kanssa. Jos puhelinta ei ole käytetty 180 päivään, sen pitää kirjautua uudelleen. Uloskirjautuminen tai tilin poistaminen sovelluksessa poistaa sen.",
          "Jos sallit ilmoitukset, puhelin antaa meille push-osoitteen. Tallennamme sen tiliisi ja kerromme sen avulla varauksista, viesteistä ja valvontalaitteen hälytyksistä. Ilmoitukset kulkevat Expon push-palvelun kautta, joka välittää ne perille Applelle (iPhonessa) tai Googlen Firebase Cloud Messagingille (Androidissa). Nämä palvelut näkevät push-osoitteen ja ilmoituksen tekstin. Voit poistaa ilmoitukset käytöstä sovelluksessa tai puhelimen asetuksissa milloin tahansa.",
          "Sovellus pyytää pääsyä kuviisi tai kameraan vain, kun lisäät kuvia ilmoitukseen, ja lähettää meille vain valitsemasi kuvat. Sovelluksen kartat tulevat iPhonessa Apple Mapsista ja Androidissa Google Mapsista. Tallentamasi mökit, kieli ja muut vastaavat valinnat pysyvät puhelimessa. Sovelluksessa ei ole mainontaa, analytiikkaa eikä seurantaa.",
          "Käsittelyperuste: palvelun tuottaminen, johon kirjauduit (6 artiklan 1 kohdan b alakohta); ilmoitusten osalta suostumuksesi (a alakohta), jonka perut poistamalla ilmoitukset käytöstä.",
        ],
      },
      {
        heading: "Mökin valvontalaite",
        paragraphs: [
          "Omistaja, joka asentaa Rantion valvontalaitteen, liittää sen tiliinsä ja mökkiinsä. Laite lähettää meille mobiiliverkon kautta mökin lukemat: lämpötilan sisällä ja saunassa, kosteuden, vesivuodot, onko ovi auki, verkkovirran, akun varauksen ja signaalin voimakkuuden. Käytämme niitä näyttääksemme omistajalle mökin tilan ja hälyttääksemme esimerkiksi pakkasesta, sähkökatkosta tai vuodosta. Koska esimerkiksi oven tai saunan lukemista voi päätellä, milloin mökillä on joku, näytämme ne vain omistajalle. Lukemia säilytetään 180 päivää.",
          "Jos liityt laitteen odotuslistalle, tallennamme sähköpostiosoitteesi, maan, kielen, vuokraatko mökkiä sekä suostumuksesi, ja käytämme niitä vain kertoaksemme, kun laite on saatavilla.",
          "Käsittelyperuste: palvelun tuottaminen omistajalle (b alakohta); odotuslistan osalta suostumuksesi (a alakohta).",
        ],
      },
      {
        heading: "Tapahtumat mökin lähellä",
        paragraphs: [
          "Mökin sivulla voi näkyä lähialueen tapahtumia vierailusi ajalta. Niitä varten palvelimemme kysyy pääkaupunkiseudun avoimesta tapahtumatietokannasta (Linked Events) ja Ticketmasterilta tapahtumia mökin läheltä noiden päivien ajalta. Se lähettää vain mökin sijainnin ja päivät, ei mitään sinusta.",
          "Ticketmasterin linkit voivat olla kumppanilinkkejä, ja sivulla kerrotaan, kun ne ovat. Jos ostat lippuja sellaisen kautta, Ticketmaster maksaa Rantiolle pienen palkkion kumppaniverkostonsa Impactin kautta; sinä maksat saman hinnan. Kun avaat tällaisen linkin, Impact ja Ticketmaster kirjaavat käynnin omilla sivustoillaan (esimerkiksi evästeillä), jotta myynti hyvitetään meille, ja niillä sovelletaan niiden omia tietosuojakäytäntöjä. Palkkio ei koskaan vaikuta siihen, mitä tapahtumia näytämme tai missä järjestyksessä.",
        ],
      },
      {
        heading: "Uutiskirje",
        paragraphs: [
          "Jos tilaat uutiskirjeemme sivun alareunasta, tallennamme sähköpostiosoitteesi ja sivuston kielen ja lähetämme sinulle vahvistuslinkin. Olet listalla vasta, kun olet avannut sen. Sen jälkeen lähetämme silloin tällöin sähköpostia uusista mökeistä, vuodenajoista ja matkailusta Pohjoismaissa ja Baltiassa. Jokaisessa uutiskirjeessä on linkki tilauksen perumiseen, samoin vahvistussivulla.",
          "Oikeusperuste: suostumuksesi (6 artiklan 1 kohdan a alakohta), jonka voit perua milloin tahansa perumalla tilauksen. Vahvistamattomat tilaukset poistetaan 30 päivän kuluttua. Jos perut tilauksen, säilytämme vain osoitteesi ja päivämäärän, jotta emme lähetä sinulle enää viestejä.",
        ],
      },
      {
        heading: "Varaukset ja kalenterit",
        paragraphs: [
          "Pitääksemme omistajan kalenterit ajan tasalla ja laskeaksemme provisiot käsittelemme varaustietoja, jotka tulevat varaussivustoilta kanavanhallintajärjestelmämme kautta sekä Nettimökin varausviesteistä, jotka omistajat välittävät meille. Niissä on vieraan nimi, päivät, henkilömäärä ja maksettu summa, joskus myös sivuston jakamat yhteystiedot. Käytämme niitä vain päivien estämiseen, varausten näyttämiseen omistajalle ja provisiomme laskuttamiseen.",
          "Käsittelyperuste: palvelun tuottaminen omistajalle (b alakohta) ja oikeutettu etumme estää päällekkäiset varaukset (f alakohta). Jos varasit mökin vieraana, itse varauksesta vastaavat varaussivusto ja omistaja, ja siihen sovelletaan niiden omia tietosuojakäytäntöjä.",
        ],
      },
      {
        heading: "Tekoälyn vastausehdotukset",
        paragraphs: [
          "Omistaja voi pyytää ehdotuksen vastaukseksi vieraalle. Vasta kun hän painaa painiketta, lähetämme keskustelun (myös vieraan nimen ja viestit) ja mökin tiedot Anthropicille, jonka tekoälymalli kirjoittaa luonnoksen. Omistaja lukee ja muokkaa luonnosta ennen kuin mitään lähetetään. Kenestäkään ei tehdä automaattisia päätöksiä.",
          "Käsittelyperuste: oikeutettu etumme auttaa omistajia vastaamaan vieraille nopeasti ja hyvin (f alakohta). Anthropic ei kaupallisten ehtojensa mukaan käytä näitä tietoja mallien kouluttamiseen.",
        ],
      },
      {
        heading: "Sivuston käyttö",
        paragraphs: [
          "Palvelimemme kirjaavat jokaisesta pyynnöstä teknisiä tietoja, kuten IP-osoitteen, ajan, sivun ja selaimen tyypin. Tarvitsemme niitä sivuston ylläpitoon, väärinkäytösten estämiseen (esimerkiksi liian moneen lomakkeeseen samasta osoitteesta) ja virheiden korjaamiseen. Lokeja säilytetään vain lyhyen aikaa. Ensimmäisellä käynnillä sivusto selvittää omalla palvelimellamme, missä maassa IP-osoitteesi on (internetin osoiterekisterien julkisista luetteloista), jotta sivu avautuu maasi kielellä; maata ei tallenneta. Käsittelyperuste: oikeutettu etumme turvalliseen ja toimivaan palveluun (f alakohta).",
          "Osa sivuston sisällöstä ladataan suoraan muista palveluista: kartat Google Mapsista (OpenStreetMapista, kun Google Maps ei ole käytössä), lähialueen kohteet ja niiden kuvat Wikipediasta ja mökkien kuvat Unsplashista. Selaimesi ottaa silloin yhteyttä näihin palveluihin suoraan, joten ne näkevät IP-osoitteesi kuten mikä tahansa verkkosivusto. Emme lähetä niille muuta tietoa sinusta.",
        ],
      },
      {
        heading: "Kuka tietojasi käsittelee",
        paragraphs: [
          "Mökkien omistajat näkevät kysymykset ja viestit, jotka vieraat heille lähettävät. Annamme tietoja viranomaisille vain, kun laki sitä vaatii.",
          "Emme myy henkilötietoja emmekä jaa niitä mainontaan. Käytämme seuraavia palveluntarjoajia, jotka käsittelevät tietoja puolestamme ja vain ohjeidemme mukaan:",
        ],
        list: [
          "Hetzner Online (Saksa): palvelimet Helsingissä, joissa tietokantamme ja tiedostomme ovat",
          "Brevo (Ranska): toimittaa sähköpostimme ja tekstiviestimme (kirjautumiskoodit, viestit ja ilmoitukset)",
          "Stripe: omistajien laskut ja maksut",
          "Anthropic: tekoälyn vastausluonnokset, vain kun omistaja pyytää",
          "OpenStreetMap (Nominatim): etsii mökin katuosoitteen kartalta, kun omistaja asettaa nastaa; palveluun lähetetään vain osoite, paikkakunta ja maa",
          "Google ja Apple: kirjautuminen, vain jos valitset Google- tai Apple-tilisi; sovelluksen ilmoitukset (Firebase Cloud Messaging ja Applen push-palvelu); sekä sovelluksen kartat",
          "Expo (Yhdysvallat): toimittaa sovelluksen ilmoitukset Applelle ja Googlelle",
          "Ticketmaster ja Linked Events: tapahtumatiedot mökin läheltä; niille lähetetään vain sijainti ja päivät",
          "Beds24: kanavanhallintajärjestelmä, joka yhdistää omistajien kalenterit ja ilmoitukset varaussivustoihin",
          "Varaussivustot, kuten Airbnb, Booking.com ja Vrbo: ne saavat meiltä mökin ilmoituksen ja kalenterin ja lähettävät meille varausten tiedot. Ne päättävät itse, miten käyttävät vieraiden tietoja.",
        ],
      },
      {
        heading: "Siirrot EU:n ulkopuolelle",
        paragraphs: [
          "Säilytämme tietomme EU:ssa. Anthropic, Stripe ja Expo voivat käsitellä tietoja Yhdysvalloissa, samoin Apple ja Google ilmoituksia toimittaessaan. Silloin siirto on suojattu EU:n ja Yhdysvaltojen välisellä tietosuojakehyksellä (Data Privacy Framework) tai Euroopan komission vakiosopimuslausekkeilla sekä palveluntarjoajien omilla turvatoimilla. Sama koskee muita palveluntarjoajia, jos ne käsittelevät tietoja EU:n tai ETA:n ulkopuolella. Kysy meiltä, jos haluat tietää näistä suojatoimista lisää.",
        ],
      },
      {
        heading: "Kuinka kauan säilytämme tietoja",
        paragraphs: ["Säilytämme tietoja vain niin kauan kuin tarvitsemme:"],
        list: [
          "Vieraiden keskustelut: enintään 24 kuukautta viimeisestä viestistä, minkä jälkeen ne poistetaan",
          "Uutiskirje: kunnes perut tilauksen; vahvistamattomat tilaukset 30 päivää",
          "Ilmoittautumiset omistajilta, joista ei tule asiakkaita: enintään 24 kuukautta viimeisestä yhteydenotosta",
          "Omistajien tilit, mökit ja varaukset: sopimuksen ajan ja enintään 12 kuukautta sen päättymisen jälkeen",
          "Laskut ja muu kirjanpitoaineisto: kuusi vuotta tilikauden päättymisestä, kuten kirjanpitolaki edellyttää",
          "Palvelinlokit: lyhyen aikaa, yleensä muutaman viikon",
          "Sovelluksen kirjautumiset ja push-osoitteet: kunnes kirjaudut ulos kyseisellä puhelimella tai poistat tilisi",
          "Valvontalaitteen lukemat: 180 päivää; laitteen odotuslista: kunnes pyydät poistamaan tietosi tai poistat tilisi",
        ],
      },
      {
        heading: "Evästeet ja selaimen tallennustila",
        paragraphs: [
          "Emme käytä analytiikka-, mainos- tai seurantaevästeitä, emmekä seuraa sinua muilla sivustoilla. Tallennamme vain sen, mitä sivusto tarvitsee toimiakseen, ja sen, minkä itse valitset.",
          "Voit poistaa evästeet ja tallennetut tiedot selaimesi asetuksista milloin tahansa. Sivusto toimii silti, mutta joudut ehkä valitsemaan kielen tai kirjautumaan uudelleen.",
          "Mitä tallennamme:",
        ],
        list: [
          "stugora_lang-eväste: valitsemasi kieli vuoden ajan. Se asetetaan vain, kun valitset kielen.",
          "sessionid-eväste: pitää mökin omistajan kirjautuneena enintään 30 päivää tai uloskirjautumiseen asti",
          "csrftoken-eväste: turvaeväste, joka estää muita sivustoja lähettämästä lomakkeita nimissäsi",
          "Selaimen paikallinen tallennustila: valitsemasi valuutta, tallentamasi mökit sekä välimuistiin tallennetut valuuttakurssit, etusivun kuvat ja lähialueen kohteet, jotta sivut latautuvat nopeammin. Tiedot pysyvät laitteellasi, emmekä saa niitä.",
          "Selainvälilehden istuntotallennus: oletko kirjautunut omistajana, jotta valikossa näkyy oikea linkki",
        ],
      },
      {
        heading: "Oikeutesi",
        paragraphs: [
          `Voit käyttää oikeuksiasi lähettämällä sähköpostia osoitteeseen ${CONTACT_EMAIL}. Saatamme pyytää sinua vahvistamaan henkilöllisyytesi ennen kuin toimimme.`,
          "Sinulla on oikeus:",
        ],
        list: [
          "nähdä sinusta tallennetut henkilötiedot ja saada niistä kopio",
          "korjata virheelliset tiedot",
          "saada tietosi poistetuksi, kun emme enää tarvitse niitä tai meillä ei ole perustetta säilyttää niitä",
          "rajoittaa tietojen käyttöä tai vastustaa käyttöä, joka perustuu oikeutettuun etuumme",
          "saada antamasi tiedot koneluettavassa muodossa ja siirtää ne muualle",
          "perua suostumuksesi milloin tahansa; peruminen ei vaikuta siihen, mitä on tehty sitä ennen",
        ],
      },
      {
        heading: "Valitukset",
        paragraphs: [
          "Jos koet, että käsittelemme tietojasi väärin, kerro siitä ensin meille, niin yritämme korjata asian. Voit myös tehdä valituksen tietosuojavaltuutetun toimistolle (tietosuoja.fi) tai sen EU-maan tietosuojaviranomaiselle, jossa asut.",
        ],
      },
      {
        heading: "Muutokset",
        paragraphs: [
          "Kun muutamme tätä selostetta, päivitämme ylhäällä olevan päivämäärän. Jos muutos koskee sinua omistajana, kerromme siitä myös sähköpostilla.",
        ],
      },
    ],
  },

  terms: {
    title: "Käyttöehdot",
    description: "Rantio.fi-sivuston käyttöehdot: mikä sivusto on, miten varaukset toimivat ja mistä vastaamme.",
    updated: UPDATED,
    intro: "Nämä ehdot koskevat rantio.fi-sivuston käyttöä. Olemme pitäneet ne lyhyinä ja selkeinä. Käyttämällä sivustoa hyväksyt ne.",
    sections: [
      {
        heading: "Kuka Rantiota ylläpitää",
        paragraphs: [
          `Rantio on suomalaisen toiminimen Elda-Auto Tmi:n aputoiminimi (Y-tunnus 2565459-6, ALV-numero FI25654596). Tavoitat meidät osoitteesta ${CONTACT_EMAIL}.`,
          "Rantio ilmoittaa pohjoismaisia ja baltialaisia lomamökkejä omistajiensa puolesta Airbnb:ssä, Booking.comissa, Vrbossa ja muilla sivustoilla. Rantio.fi:ssä voit selata mökkejä, nähdä mistä kunkin voi varata ja lähettää omistajalle kysymyksen.",
        ],
      },
      {
        heading: "Varaaminen ja maksaminen",
        paragraphs: [
          "Rantio.fi:ssä ei varata eikä makseta. Varaukset ja maksut tehdään varaussivustoilla, kuten Airbnb:ssä, Booking.comissa tai Vrbossa, kyseisen sivuston omien ehtojen, peruutusehtojen ja tietosuojakäytännön mukaan. Vuokrasopimus syntyy sinun ja omistajan välille sivuston kautta; Rantio ei ole sen osapuoli.",
          "Varausta, maksua tai hyvitystä koskevat kysymykset kannattaa osoittaa sille sivustolle, jolla teit varauksen, tai omistajalle.",
        ],
      },
      {
        heading: "Mökkien tiedot",
        paragraphs: [
          "Omistajat antavat meille mökkiensä kuvaukset, kuvat, hinnat ja muut tiedot. Tarkistamme ne niin hyvin kuin kohtuudella voimme, mutta emme voi luvata, että jokainen tieto on oikein ja ajan tasalla. Ratkaisevaa on se, mitä varaussivusto näyttää varaushetkellä.",
          "Rantio.fi:n hinnat ovat suuntaa antavia. Muuhun kuin mökin omaan valuuttaan muunnetut hinnat lasketaan Euroopan keskuspankin viitekursseilla ja ovat arvioita; tarkan hinnan näet varaussivustolta.",
        ],
      },
      {
        heading: "Yhteydenotto omistajaan",
        paragraphs: [
          "Yhteydenottolomake on tarkoitettu mökkiä ja majoitusta koskeviin kysymyksiin. Välitämme viestisi omistajalle, joka päättää, vastaako hän ja miten. Kysymys ei ole varaus. Voimme poistaa viestejä ja estää lomakkeen käytön, jos näitä sääntöjä rikotaan.",
          "Kun käytät lomaketta:",
        ],
        list: [
          "Käytä oikeaa nimeäsi ja sähköpostiosoitetta, jota luet.",
          "Ole kohtelias ja kirjoita vain mökistä tai majoituksestasi.",
          "Älä lähetä mainoksia, roskapostia tai mitään laitonta, loukkaavaa tai haitallista.",
          "Älä lähetä korttinumeroita, salasanoja tai muita arkaluonteisia tietoja.",
          "Pidä yksityinen keskustelulinkkisi omana tietonasi; kuka tahansa, jolla on linkki, voi lukea keskustelun.",
        ],
      },
      {
        heading: "Omistajien tilit",
        paragraphs: [
          "Mökkien omistajat voivat ilmoittautua mukaan lomakkeella; lomakkeen lähettäminen ei sido sinua mihinkään. Omistajat kirjautuvat sisään sähköpostiin lähetettävällä kertakäyttöisellä koodilla, joten pidä sähköpostitilisi turvassa äläkä jaa koodeja.",
          "Palvelustamme omistajille, kuten vuosimaksusta mökkiä kohden (99 euroa, tai Ruotsissa, Norjassa, Tanskassa tai Islannissa olevasta mökistä 1 080 SEK, 1 030 NOK, 740 DKK tai 13 500 ISK), 12 prosentin provisiosta Rantion lisäämien kanavien varauksista (molempiin lisätään arvonlisävero), maksuttomasta kokeilusta (ei vuosimaksua 3 ensimmäiseltä kuukaudelta ilmoituksen julkaisusta) ja laskutuksesta Stripen kautta ilmoittautuessa tallennetulta kortilta, sovitaan erillisessä palvelusopimuksessa, jonka allekirjoitamme jokaisen omistajan kanssa. Jos sopimus poikkeaa näistä ehdoista, noudatetaan sopimusta.",
        ],
      },
      {
        heading: "Sivuston sisältö",
        paragraphs: [
          "Sivuston tekstit, ulkoasu ja Rantio-nimi kuuluvat meille; mökkien kuvat ja kuvaukset kuuluvat omistajilleen tai kuvaajilleen. Saat vapaasti katsella sivustoa ja jakaa linkkejä, mutta älä kopioi ilmoituksia massoittain, kaavi sivustoa tai käytä sitä tavalla, joka vahingoittaa sitä tai muita.",
        ],
      },
      {
        heading: "Mistä vastaamme",
        paragraphs: [
          "Teemme parhaamme, jotta rantio.fi on käytettävissä ja sen tiedot oikein, mutta tarjoamme sivuston sellaisenaan, ja se voi joskus olla poissa käytöstä tai sisältää virheitä.",
          "Emme vastaa itse majoituksesta, omistajien tai varaussivustojen toiminnasta emmekä linkittämiemme muiden sivustojen sisällöstä. Emme vastaa sivuston käytöstä aiheutuvista välillisistä vahingoista, kuten saamatta jääneestä voitosta.",
          "Mikään näissä ehdoissa ei rajoita pakottavan kuluttajansuojalainsäädännön mukaisia oikeuksiasi eikä vastuutamme tahallisesti tai törkeällä huolimattomuudella aiheutetusta vahingosta.",
        ],
      },
      {
        heading: "Muutokset",
        paragraphs: [
          "Voimme päivittää näitä ehtoja. Ylhäällä oleva päivämäärä kertoo uusimman version, ja sovellamme sitä versiota, joka on voimassa käyttäessäsi sivustoa.",
        ],
      },
      {
        heading: "Sovellettava laki ja riidat",
        paragraphs: [
          "Näihin ehtoihin sovelletaan Suomen lakia. Jos jokin menee pieleen, ota ensin yhteyttä meihin, niin yritämme ratkaista asian. Kuluttaja voi myös pyytää apua kuluttajaneuvonnasta ja viedä riidan kuluttajariitalautakunnan (kuluttajariita.fi) käsiteltäväksi, ja hän säilyttää kotimaansa pakottavan kuluttajalainsäädännön suojan. Muutoin riidat ratkaistaan Helsingin käräjäoikeudessa.",
        ],
      },
    ],
  },
};
