import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Se {n} sommerhus", other: "Se {n} sommerhuse" },
  seasons: {
    summer: "Sommer",
    autumn: "Sensommer og efterår",
    winter: "Vinter",
    allYear: "Hele året",
  },

  experiences: {
    meta: {
      title: "Oplevelser ved et nordisk sommerhus | Stugora",
      description: "Sauna, badning, kajak og kano, fiskeri, vandring, skiløb og nordlys: find et sommerhus til det, du har lyst til.",
    },
    title: "Oplevelser ved sommerhuset",
    lead: "Sauna ved søen, kano i det lange aftenlys, skiløb og nordlys. Vælg, hvad du har lyst til, og se de sommerhuse, der passer.",
    note: "Stugora sælger ikke oplevelser. Ejeren kan fortælle, hvad der ligger i nærheden, og lokale guider tager imod bestillinger på for eksempel hundeslædeture og nordlysture.",
    items: {
      sauna: {
        title: "Sauna og en kølig dukkert",
        body: "Varm op i husets egen sauna, og køl af i søen eller havet. Om vinteren tager de modigste en dukkert i en våge.",
      },
      swim: {
        title: "Badning fra egen strand",
        body: "Mange huse ligger lige ned til vandet, med badebro eller sandstrand få skridt fra døren.",
      },
      paddling: {
        title: "Kano og kajak",
        body: "Stille søer og lune vige er som skabt til kano. Ved disse huse står der en klar til dig.",
      },
      fishing: {
        title: "Fiskeri fra båd",
        body: "Ro ud en aften, eller fisk gennem isen om vinteren. Enkelt stangfiskeri er gratis mange steder, men andet fiskeri kræver fisketegn.",
      },
      hiking: {
        title: "Skovture og vilde bær",
        body: "Stierne starter ved døren. Fra juli kan du plukke blåbær, tyttebær og svampe efter allemandsretten.",
      },
      aurora: {
        title: "Nordlys",
        body: "Fra slutningen af august til begyndelsen af april giver mørke himmelstrøg i Lapland, Nordnorge og Island de bedste chancer.",
      },
      skiing: {
        title: "Alpint og langrend",
        body: "Bo tæt på pisterne, eller tag ud på langrendsløjper, der går forbi huset.",
      },
      dogs: {
        title: "Ferie med hunden",
        body: "Masser af plads at boltre sig på og ejere, der byder firbenede gæster velkommen. Tjek husets egne regler, før du booker.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Sommerhusrejsemål i Norden og Baltikum | Stugora",
      description: "Finland, Sverige, Norge, Danmark, Island, Estland, Letland og Litauen: søer, fjorde, klitter og skove, og sommerhusene der.",
    },
    title: "Rejsemål",
    lead: "Otte lande omkring Østersøen og Nordatlanten, hver med sin egen slags sommerhus.",
    regions: "Sommerhuse i",
    allIn: "Alle sommerhuse i {country}",
    countries: {
      FI: "Tusindvis af søer, sauna ved næsten hvert hus og Laplands sne og nordlys.",
      SE: "Røde træhuse dybt inde i skoven, en skærgårdskyst og fjelde mod nord.",
      NO: "Fjorde, fiskerhytter ved vandet og bjerge, der styrter lige ned i havet.",
      DK: "Klitsommerhuse bag lange sandstrande, med Vesterhavet en kort gåtur væk.",
      IS: "Fjorde, varme kilder og en vid himmel, der er mørk nok til nordlys om vinteren.",
      EE: "Stille øer, enebærenge og røgsaunaen, en gammel estisk tradition.",
      LV: "Søområdet Latgale, fyrreskove og en lang sandet østersøkyst.",
      LT: "Klitterne på Kuriske Tange, stråtækte gårde og stille søer på landet.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiration til sommerhusferien | Stugora",
      description: "Korte guider om sauna, nordlys, allemandsretten, sankthans og vinter i et nordisk sommerhus.",
    },
    title: "Inspiration",
    lead: "Korte guider til sommerhusferien, fra saunaen til nordlyset.",
    read: "Læs guiden",
    minutes: { one: "{n} min. læsning", other: "{n} min. læsning" },
    back: "Alle guider",
    ctaTitle: "Find et sommerhus til det",
    more: "Flere guider",
  },

  guides: {
    sauna: {
      title: "Gå i sauna som de lokale",
      lead: "Husets sauna er hjertet i en nordisk aften, og det er nemmere, end det ser ud.",
      sections: [
        {
          heading: "Varm den op",
          body: "En brændefyret sauna tager omkring en time om at blive varm, en elektrisk 30 til 45 minutter. Omkring 70 til 80 °C er rigeligt. Tag noget at drikke med og et lille håndklæde at sidde på.",
        },
        {
          heading: "Varme, afkøling, igen",
          body: "Hæld en øse vand på de varme sten for en bølge af damp, som finnerne kalder löyly. Bliv så længe, det føles godt, køl så af i søen, havet eller under bruseren, hvil lidt og gå ind igen. To eller tre omgange er almindeligt.",
        },
        {
          heading: "Saunaskik",
          body: "Gå i bad, før du går ind. Familier går ofte nøgne i sauna, og badetøj er fint blandt venner. Lad aldrig en brændeovn være uden opsyn, mens der er ild i den, og spørg ejeren, hvordan saunaen skal efterlades.",
        },
      ],
    },
    aurora: {
      title: "Hvornår og hvor du ser nordlyset",
      lead: "Mørk, klar himmel betyder mere end held. Sådan giver du dig selv de bedste chancer.",
      sections: [
        {
          heading: "Hvornår du skal rejse",
          body: "Sæsonen varer cirka fra slutningen af august til begyndelsen af april, når nætterne er mørke nok. Timerne omkring midnat er ofte bedst, men nordlyset kan dukke op, når som helst det er mørkt.",
        },
        {
          heading: "Hvor du skal bo",
          body: "Jo længere mod nord du er, jo oftere ser du det. I finsk og svensk Lapland, Nordnorge og Island ses det mange klare nætter; i Sydfinland og Baltikum kun når aktiviteten er stærk.",
        },
        {
          heading: "Sådan ser du det",
          body: "Kom væk fra lys: en åben søbred eller en fjeldtop er ideel. Tjek skyprognosen og en nordlysprognose, klæd dig varmt på og giv øjnene et kvarter til at vænne sig til mørket. Et mobilkamera i nattilstand ser ofte mere end dig.",
        },
      ],
    },
    everyman: {
      title: "Allemandsretten: færdsel, bær og bål",
      lead: "I Finland, Sverige, Norge og Estland er naturen åben for alle, så længe du følger nogle få enkle regler.",
      sections: [
        {
          heading: "Det må du",
          body: "Du må gå, stå på ski og cykle i skov og mark, bade i søer og hav og plukke vilde bær, svampe og blomster, der ikke er fredede, også på jord, som andre ejer.",
        },
        {
          heading: "Husk det her",
          body: "Hold respektfuld afstand til huse og haver, forstyr ikke dyr eller ynglende fugle, skad ikke levende træer, og tag dit affald med dig.",
        },
        {
          heading: "Bål og fiskeri",
          body: "Bål på andres jord kræver som regel ejerens tilladelse, og der gælder afbrændingsforbud, når det er tørt. Enkelt stangfiskeri er gratis mange steder, men andet fiskeri kræver fisketegn. Reglerne er forskellige fra land til land, så spørg husets ejer.",
        },
      ],
    },
    midsummer: {
      title: "Sankthans i sommerhuset",
      lead: "Årets længste dage er Nordens kæreste fest, og mange tilbringer dem i et sommerhus.",
      sections: [
        {
          heading: "Hvornår det er",
          body: "I Finland og Sverige er midsommeraften fredagen mellem den 19. og 25. juni. Norge og Danmark fejrer sankthans den 23. juni, og Estland, Letland og Litauen har deres egne midsommerfester den 23. og 24. juni.",
        },
        {
          heading: "Sådan fejres den",
          body: "Bål ved vandet, sauna, nye kartofler og sild, blomsterkranse og dans, alt efter land. Nord for polarcirklen går solen slet ikke ned.",
        },
        {
          heading: "Planlæg i god tid",
          body: "Midsommer er en af sommerhusenes travleste uger, og mange butikker lukker eller har korte åbningstider i helligdagene. Book tidligt og køb ind, før festen begynder.",
        },
      ],
    },
    winter: {
      title: "Dit første vintersommerhus",
      lead: "Sne, stilhed og en varm brændeovn. Nogle få ting gør vinteropholdet lettere.",
      sections: [
        {
          heading: "At komme frem",
          body: "Tjek, at vejen til huset er ryddet for sne, og om du kan parkere tæt på døren. Vinterdæk er påbudt om vinteren i det meste af regionen, og lejebiler har dem.",
        },
        {
          heading: "Hold varmen",
          body: "Mange huse holdes kun lige over frysepunktet, når de står tomme, så der kan gå et par timer, før det bliver varmt. Spørg ejeren, hvordan varmen og brændeovnen virker, og hvor brændet er.",
        },
        {
          heading: "Korte dage",
          body: "I december er solen kun oppe nogle få timer i syd og slet ikke længst mod nord. Planlæg tiden udenfor efter lyset, tag en pandelampe med og nyd sneens skær.",
        },
      ],
    },
  },
};
