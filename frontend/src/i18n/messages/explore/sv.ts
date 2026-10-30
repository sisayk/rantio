import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Visa {n} stuga", other: "Visa {n} stugor" },
  seasons: {
    summer: "Sommar",
    autumn: "Sensommar och höst",
    winter: "Vinter",
    allYear: "Året runt",
  },

  experiences: {
    meta: {
      title: "Saker att göra vid en nordisk stuga | Stugora",
      description: "Bastu, bad, paddling, fiske, vandring, skidåkning och norrsken: hitta en stuga för det du vill göra.",
    },
    title: "Saker att göra vid stugan",
    lead: "Bastu vid sjön, paddling i det långa kvällsljuset, skidåkning och norrsken. Välj vad du vill göra och se stugorna som passar.",
    note: "Stugora säljer inga aktiviteter. Ägaren kan berätta vad som finns i närheten, och lokala guider tar bokningar för till exempel hundspann och norrskensturer.",
    items: {
      sauna: {
        title: "Bastu och ett svalkande dopp",
        body: "Värm upp i stugans egen bastu och svalka dig i sjön eller havet. På vintern tar de modigaste ett dopp i en vak.",
      },
      swim: {
        title: "Bad från egen strand",
        body: "Många stugor ligger precis vid vattnet, med brygga eller sandstrand några steg från dörren.",
      },
      paddling: {
        title: "Kanot och paddling",
        body: "Lugna sjöar och skyddade vikar är som gjorda för kanot. Vid de här stugorna väntar en på dig.",
      },
      fishing: {
        title: "Fiske från båt",
        body: "Ro ut en kväll eller pimpla genom isen på vintern. Handredskapsfiske är fritt på många ställen, men annat fiske kräver fiskekort.",
      },
      hiking: {
        title: "Skogspromenader och vilda bär",
        body: "Stigarna börjar vid dörren. Från juli plockar du blåbär, lingon och svamp enligt allemansrätten.",
      },
      aurora: {
        title: "Norrsken",
        body: "Från slutet av augusti till början av april ger mörka himlar i Lappland, norra Norge och Island de bästa chanserna.",
      },
      skiing: {
        title: "Utförsåkning och längdskidor",
        body: "Bo nära backarna eller ge dig ut på längdspår som går förbi stugan.",
      },
      dogs: {
        title: "Semester med hunden",
        body: "Gott om plats att ströva och ägare som välkomnar fyrbenta gäster. Kolla stugans egna regler innan du bokar.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Stugdestinationer i Norden och Baltikum | Stugora",
      description: "Finland, Sverige, Norge, Danmark, Island, Estland, Lettland och Litauen: sjöar, fjordar, dyner och skogar, och stugorna där.",
    },
    title: "Destinationer",
    lead: "Åtta länder runt Östersjön och Nordatlanten, var och ett med sin egen sorts stuga.",
    regions: "Stugor i",
    allIn: "Alla stugor i {country}",
    countries: {
      FI: "Tusentals sjöar, bastu vid nästan varje stuga och Lapplands snö och norrsken.",
      SE: "Röda trästugor djupt inne i skogen, en kust full av skär och fjäll i norr.",
      NO: "Fjordar, fiskestugor vid stranden och berg som stupar rakt ner i havet.",
      DK: "Klitstugor bakom långa sandstränder, med Nordsjön ett kort promenadavstånd bort.",
      IS: "Fjordar, varma källor och vida himlar som är mörka nog för norrsken på vintern.",
      EE: "Lugna öar, enbuskhagar och rökbastun, en gammal estnisk tradition.",
      LV: "Sjölandskapet i Latgale, tallskogar och en lång sandig östersjökust.",
      LT: "Dynerna på Kuriska näset, halmtäckta gårdar och stilla sjöar på landet.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiration för stugsemestern | Stugora",
      description: "Korta guider om bastun, norrskenet, allemansrätten, midsommar och vinter i en nordisk stuga.",
    },
    title: "Inspiration",
    lead: "Korta guider för stugsemestern, från bastun till norrskenet.",
    read: "Läs guiden",
    minutes: { one: "{n} min läsning", other: "{n} min läsning" },
    back: "Alla guider",
    ctaTitle: "Hitta en stuga för det",
    more: "Fler guider",
  },

  guides: {
    sauna: {
      title: "Basta som en lokal",
      lead: "Stugans bastu är hjärtat i en nordisk kväll, och det är enklare än det ser ut.",
      sections: [
        {
          heading: "Värm upp",
          body: "En vedeldad bastu tar ungefär en timme att värma, en elbastu 30 till 45 minuter. Runt 70 till 80 °C räcker gott. Ta med något att dricka och en liten handduk att sitta på.",
        },
        {
          heading: "Värme, svalka, igen",
          body: "Kasta en skopa vatten på de heta stenarna för en våg av ånga, som finländarna kallar löyly. Stanna så länge det känns skönt, svalka dig sedan i sjön, havet eller duschen, vila en stund och gå in igen. Två eller tre omgångar är vanligt.",
        },
        {
          heading: "Bastuvett",
          body: "Duscha innan du går in. Familjer badar ofta nakna, och badkläder går bra bland vänner. Lämna aldrig en vedkamin utan tillsyn medan elden brinner, och fråga ägaren hur bastun ska lämnas.",
        },
      ],
    },
    aurora: {
      title: "När och var du ser norrsken",
      lead: "Mörk och klar himmel betyder mer än tur. Så ger du dig själv de bästa chanserna.",
      sections: [
        {
          heading: "När du ska åka",
          body: "Säsongen pågår ungefär från slutet av augusti till början av april, när nätterna är mörka nog. Timmarna kring midnatt är ofta bäst, men norrskenet kan dyka upp när som helst när det är mörkt.",
        },
        {
          heading: "Var du ska bo",
          body: "Ju längre norrut du är, desto oftare ser du det. I finska och svenska Lappland, norra Norge och på Island syns det många klara nätter; i södra Finland och Baltikum bara när aktiviteten är stark.",
        },
        {
          heading: "Så tittar du",
          body: "Kom bort från ljus: en öppen sjöstrand eller en fjälltopp är perfekt. Kolla molnprognosen och en norrskensprognos, klä dig varmt och ge ögonen en kvart att vänja sig. En mobilkamera i nattläge ser ofta mer än du gör.",
        },
      ],
    },
    everyman: {
      title: "Allemansrätten: ströva, plocka bär och göra upp eld",
      lead: "I Finland, Sverige, Norge och Estland är naturen öppen för alla, så länge du följer några enkla regler.",
      sections: [
        {
          heading: "Det här får du göra",
          body: "Du får gå, åka skidor och cykla i skog och mark, bada i sjöar och hav och plocka vilda bär, svamp och blommor som inte är fridlysta, även på mark som någon annan äger.",
        },
        {
          heading: "Tänk på det här",
          body: "Håll ett respektfullt avstånd till hus och trädgårdar, stör inte djur eller häckande fåglar, skada inte levande träd och ta med dig skräpet.",
        },
        {
          heading: "Eld och fiske",
          body: "Att göra upp eld på någon annans mark kräver oftast markägarens tillstånd, och eldningsförbud gäller när det är torrt. Fiske med handredskap är fritt på många ställen, men annat fiske kräver fiskekort. Reglerna skiljer sig mellan länderna, så fråga stugans ägare.",
        },
      ],
    },
    midsummer: {
      title: "Midsommar i stugan",
      lead: "Årets längsta dagar är Nordens käraste högtid, och många firar dem i en stuga.",
      sections: [
        {
          heading: "När den är",
          body: "I Finland och Sverige är midsommarafton fredagen mellan 19 och 25 juni. Norge och Danmark firar sankthans den 23 juni, och Estland, Lettland och Litauen har sina egna midsommarfester den 23 och 24 juni.",
        },
        {
          heading: "Så firas den",
          body: "Brasor vid vattnet, bastu, färskpotatis och sill, blomsterkransar och dans, beroende på land. Norr om polcirkeln går solen inte ner alls.",
        },
        {
          heading: "Planera i förväg",
          body: "Midsommar är en av stugornas mest bokade veckor, och många butiker stänger eller har korta öppettider under helgen. Boka tidigt och handla maten före midsommarafton.",
        },
      ],
    },
    winter: {
      title: "Din första vinterstuga",
      lead: "Snö, tystnad och en varm brasa. Några saker gör vintervistelsen enklare.",
      sections: [
        {
          heading: "Att ta sig dit",
          body: "Kolla att vägen till stugan är plogad och om du kan parkera nära dörren. Vinterdäck krävs på vintern i större delen av regionen, och hyrbilar har dem.",
        },
        {
          heading: "Håll värmen",
          body: "Många stugor hålls bara strax över nollan när de står tomma, så det kan ta några timmar innan det blir varmt. Fråga ägaren hur värmen och kaminen fungerar och var veden finns.",
        },
        {
          heading: "Korta dagar",
          body: "I december är solen uppe bara några timmar i söder och inte alls längst i norr. Planera tiden ute efter ljuset, ta med pannlampa och njut av snöns sken.",
        },
      ],
    },
  },
};
