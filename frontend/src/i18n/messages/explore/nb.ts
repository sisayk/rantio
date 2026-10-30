import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Vis {n} hytte", other: "Vis {n} hytter" },
  seasons: {
    summer: "Sommer",
    autumn: "Sensommer og høst",
    winter: "Vinter",
    allYear: "Hele året",
  },

  experiences: {
    meta: {
      title: "Ting å gjøre på en nordisk hytte | Stugora",
      description: "Badstue, bading, padling, fiske, tur, ski og nordlys: finn en hytte for det du har lyst til å gjøre.",
    },
    title: "Ting å gjøre på hytta",
    lead: "Badstue ved vannet, padling i det lange kveldslyset, skiturer og nordlys. Velg hva du har lyst til å gjøre, og se hyttene som passer.",
    note: "Stugora selger ikke aktiviteter. Eieren kan fortelle hva som finnes i nærheten, og lokale guider tar imot bestillinger på for eksempel hundekjøring og nordlysturer.",
    items: {
      sauna: {
        title: "Badstue og en avkjølende dukkert",
        body: "Varm deg i hyttas egen badstue og kjøl deg ned i vannet eller sjøen. Om vinteren tar de modigste en tur i en våk.",
      },
      swim: {
        title: "Bading fra egen strand",
        body: "Mange hytter ligger rett ved vannet, med brygge eller sandstrand noen skritt fra døra.",
      },
      paddling: {
        title: "Kano og padling",
        body: "Stille vann og lune viker er som skapt for kano. Ved disse hyttene står det en klar til deg.",
      },
      fishing: {
        title: "Fiske fra båt",
        body: "Ro ut en kveld, eller fisk gjennom isen om vinteren. Enkelt stangfiske er gratis mange steder, men annet fiske krever fiskekort.",
      },
      hiking: {
        title: "Skogsturer og ville bær",
        body: "Stiene starter ved døra. Fra juli kan du plukke blåbær, tyttebær og sopp etter allemannsretten.",
      },
      aurora: {
        title: "Nordlys",
        body: "Fra slutten av august til begynnelsen av april gir mørke himler i Lappland, Nord-Norge og på Island de beste sjansene.",
      },
      skiing: {
        title: "Alpint og langrenn",
        body: "Bo nær bakkene, eller legg ut på langrennsløyper som går forbi hytta.",
      },
      dogs: {
        title: "Ferie med hunden",
        body: "God plass å boltre seg på og eiere som ønsker firbeinte gjester velkommen. Sjekk hyttas egne regler før du bestiller.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Hyttereisemål i Norden og Baltikum | Stugora",
      description: "Finland, Sverige, Norge, Danmark, Island, Estland, Latvia og Litauen: innsjøer, fjorder, sanddyner og skoger, og hyttene der.",
    },
    title: "Reisemål",
    lead: "Åtte land rundt Østersjøen og Nord-Atlanteren, hvert med sin egen type hytte.",
    regions: "Hytter i",
    allIn: "Alle hytter i {country}",
    countries: {
      FI: "Tusenvis av innsjøer, badstue på nesten hver hytte og snøen og nordlyset i Lappland.",
      SE: "Røde trehytter dypt inne i skogen, en kyst full av skjær og fjell i nord.",
      NO: "Fjorder, rorbuer ved sjøen og fjell som stuper rett i havet.",
      DK: "Klitthytter bak lange sandstrender, med Nordsjøen en kort spasertur unna.",
      IS: "Fjorder, varme kilder og vide himler som er mørke nok for nordlys om vinteren.",
      EE: "Rolige øyer, einerenger og røykbadstua, en gammel estisk tradisjon.",
      LV: "Innsjølandet Latgale, furuskoger og en lang sandkyst mot Østersjøen.",
      LT: "Sanddynene på Kuriske nes, stråtakgårder og stille innsjøer på landet.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspirasjon til hytteferien | Stugora",
      description: "Korte guider om badstue, nordlys, allemannsretten, sankthans og vinter på en nordisk hytte.",
    },
    title: "Inspirasjon",
    lead: "Korte guider til hytteferien, fra badstua til nordlyset.",
    read: "Les guiden",
    minutes: { one: "{n} min lesing", other: "{n} min lesing" },
    back: "Alle guider",
    ctaTitle: "Finn en hytte for det",
    more: "Flere guider",
  },

  guides: {
    sauna: {
      title: "Ta badstue som en lokal",
      lead: "Badstua på hytta er hjertet i en nordisk kveld, og det er enklere enn det ser ut.",
      sections: [
        {
          heading: "Varm den opp",
          body: "En vedfyrt badstue bruker omtrent en time på å bli varm, en elektrisk 30 til 45 minutter. Rundt 70 til 80 °C er nok. Ta med noe å drikke og et lite håndkle å sitte på.",
        },
        {
          heading: "Varme, kjøl ned, gjenta",
          body: "Kast en øse vann på de varme steinene for en bølge av damp, det finnene kaller löyly. Bli så lenge det føles godt, kjøl deg ned i vannet, sjøen eller dusjen, hvil litt og gå inn igjen. To eller tre runder er vanlig.",
        },
        {
          heading: "Badstueskikk",
          body: "Dusj før du går inn. Familier bader ofte nakne, og badetøy går fint blant venner. La aldri en vedovn stå uten tilsyn mens det brenner, og spør eieren hvordan de vil at badstua skal forlates.",
        },
      ],
    },
    aurora: {
      title: "Når og hvor du ser nordlyset",
      lead: "Mørk og klar himmel betyr mer enn flaks. Slik gir du deg selv de beste sjansene.",
      sections: [
        {
          heading: "Når du bør dra",
          body: "Sesongen varer omtrent fra slutten av august til begynnelsen av april, når nettene er mørke nok. Timene rundt midnatt er ofte best, men nordlyset kan dukke opp når som helst det er mørkt.",
        },
        {
          heading: "Hvor du bør bo",
          body: "Jo lenger nord du er, jo oftere ser du det. I finsk og svensk Lappland, Nord-Norge og på Island vises det mange klare netter; i Sør-Finland og Baltikum bare når aktiviteten er sterk.",
        },
        {
          heading: "Slik ser du det",
          body: "Kom deg bort fra lys: en åpen strand ved vannet eller en fjelltopp er ideelt. Sjekk skyvarselet og et nordlysvarsel, kle deg varmt og gi øynene et kvarter til å venne seg til mørket. Et mobilkamera i nattmodus ser ofte mer enn deg.",
        },
      ],
    },
    everyman: {
      title: "Allemannsretten: ferdsel, bær og bål",
      lead: "I Finland, Sverige, Norge og Estland er naturen åpen for alle, så lenge du følger noen enkle regler.",
      sections: [
        {
          heading: "Dette kan du gjøre",
          body: "Du kan gå, gå på ski og sykle i skog og mark, bade i innsjøer og i sjøen og plukke ville bær, sopp og blomster som ikke er fredet, også på eiendom som andre eier.",
        },
        {
          heading: "Husk dette",
          body: "Hold god avstand til hus og hager, ikke forstyrr dyr eller hekkende fugler, ikke skad levende trær, og ta med deg søppelet.",
        },
        {
          heading: "Bål og fiske",
          body: "Bål på andres eiendom krever som regel grunneierens tillatelse, og bålforbud gjelder når det er tørt. Enkelt stangfiske er gratis mange steder, men annet fiske krever fiskekort. Reglene er forskjellige fra land til land, så spør eieren av hytta.",
        },
      ],
    },
    midsummer: {
      title: "Sankthans på hytta",
      lead: "Årets lengste dager er Nordens kjæreste høytid, og mange tilbringer dem på hytta.",
      sections: [
        {
          heading: "Når det er",
          body: "I Finland og Sverige er midtsommeraften fredagen mellom 19. og 25. juni. Norge og Danmark feirer sankthans 23. juni, og Estland, Latvia og Litauen har sine egne midtsommerfester 23. og 24. juni.",
        },
        {
          heading: "Slik feires det",
          body: "Bål ved vannet, badstue, nypoteter og sild, blomsterkranser og dans, alt etter land. Nord for polarsirkelen går ikke sola ned i det hele tatt.",
        },
        {
          heading: "Planlegg i god tid",
          body: "Midtsommer er en av de travleste ukene for hytter, og mange butikker stenger eller har korte åpningstider i høytiden. Bestill tidlig og handle maten før aftenen.",
        },
      ],
    },
    winter: {
      title: "Din første vinterhytte",
      lead: "Snø, stillhet og en varm peis. Noen få ting gjør vinteroppholdet enklere.",
      sections: [
        {
          heading: "Å komme seg dit",
          body: "Sjekk at veien til hytta er brøytet, og om du kan parkere nær døra. Vinterdekk er påbudt om vinteren i det meste av regionen, og leiebiler har dem.",
        },
        {
          heading: "Hold varmen",
          body: "Mange hytter holdes bare så vidt over frysepunktet når de står tomme, så det kan ta noen timer før det blir varmt. Spør eieren hvordan varmen og peisen fungerer, og hvor veden er.",
        },
        {
          heading: "Korte dager",
          body: "I desember er sola oppe bare noen timer i sør og ikke i det hele tatt lengst nord. Planlegg tiden ute etter lyset, ta med hodelykt og nyt skinnet fra snøen.",
        },
      ],
    },
  },
};
