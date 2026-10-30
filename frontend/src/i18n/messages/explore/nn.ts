import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Vis {n} hytte", other: "Vis {n} hytter" },
  seasons: {
    summer: "Sommar",
    autumn: "Seinsommar og haust",
    winter: "Vinter",
    allYear: "Heile året",
  },

  experiences: {
    meta: {
      title: "Ting å gjere på ei nordisk hytte | Stugora",
      description: "Badstove, bading, padling, fiske, tur, ski og nordlys: finn ei hytte for det du har lyst til å gjere.",
    },
    title: "Ting å gjere på hytta",
    lead: "Badstove ved vatnet, padling i det lange kveldslyset, skiturar og nordlys. Vel kva du har lyst til å gjere, og sjå hyttene som passar.",
    note: "Stugora sel ikkje aktivitetar. Eigaren kan fortelje kva som finst i nærleiken, og lokale guidar tek imot bestillingar på til dømes hundekøyring og nordlysturar.",
    items: {
      sauna: {
        title: "Badstove og ein avkjølande dukkert",
        body: "Varm deg i den eigne badstova til hytta og kjøl deg ned i vatnet eller sjøen. Om vinteren tek dei modigaste ein tur i ei våk.",
      },
      swim: {
        title: "Bading frå eiga strand",
        body: "Mange hytter ligg rett ved vatnet, med brygge eller sandstrand nokre steg frå døra.",
      },
      paddling: {
        title: "Kano og padling",
        body: "Stille vatn og lune viker er som skapte for kano. Ved desse hyttene står det ein klar til deg.",
      },
      fishing: {
        title: "Fiske frå båt",
        body: "Ro ut ein kveld, eller fisk gjennom isen om vinteren. Enkelt stongfiske er gratis mange stader, men anna fiske krev fiskekort.",
      },
      hiking: {
        title: "Skogsturar og ville bær",
        body: "Stigane startar ved døra. Frå juli kan du plukke blåbær, tyttebær og sopp etter allemannsretten.",
      },
      aurora: {
        title: "Nordlys",
        body: "Frå slutten av august til byrjinga av april gjev mørke himlar i Lappland, Nord-Noreg og på Island dei beste sjansane.",
      },
      skiing: {
        title: "Alpint og langrenn",
        body: "Bu nær bakkane, eller legg ut på langrennsløyper som går forbi hytta.",
      },
      dogs: {
        title: "Ferie med hunden",
        body: "God plass å boltre seg på og eigarar som ønskjer firbeinte gjester velkomne. Sjekk dei eigne reglane til hytta før du bestiller.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Hyttemål i Norden og Baltikum | Stugora",
      description: "Finland, Sverige, Noreg, Danmark, Island, Estland, Latvia og Litauen: innsjøar, fjordar, sanddyner og skogar, og hyttene der.",
    },
    title: "Reisemål",
    lead: "Åtte land rundt Austersjøen og Nord-Atlanteren, kvart med sin eigen type hytte.",
    regions: "Hytter i",
    allIn: "Alle hytter i {country}",
    countries: {
      FI: "Tusenvis av innsjøar, badstove på nesten kvar hytte og snøen og nordlyset i Lappland.",
      SE: "Raude trehytter djupt inne i skogen, ei kyst full av skjer og fjell i nord.",
      NO: "Fjordar, rorbuer ved sjøen og fjell som stuper rett i havet.",
      DK: "Klitthytter bak lange sandstrender, med Nordsjøen ein kort spasertur unna.",
      IS: "Fjordar, varme kjelder og vide himlar som er mørke nok for nordlys om vinteren.",
      EE: "Rolege øyar, einerenger og røykbadstova, ein gammal estisk tradisjon.",
      LV: "Innsjølandet Latgale, furuskogar og ei lang sandkyst mot Austersjøen.",
      LT: "Sanddynene på Kuriske nes, stråtakgardar og stille innsjøar på landet.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspirasjon til hytteferien | Stugora",
      description: "Korte guidar om badstove, nordlys, allemannsretten, sankthans og vinter på ei nordisk hytte.",
    },
    title: "Inspirasjon",
    lead: "Korte guidar til hytteferien, frå badstova til nordlyset.",
    read: "Les guiden",
    minutes: { one: "{n} min lesing", other: "{n} min lesing" },
    back: "Alle guidar",
    ctaTitle: "Finn ei hytte for det",
    more: "Fleire guidar",
  },

  guides: {
    sauna: {
      title: "Ta badstove som ein lokal",
      lead: "Badstova på hytta er hjartet i ein nordisk kveld, og det er enklare enn det ser ut.",
      sections: [
        {
          heading: "Varm henne opp",
          body: "Ei vedfyrt badstove brukar om lag ein time på å bli varm, ei elektrisk 30 til 45 minutt. Rundt 70 til 80 °C er nok. Ta med noko å drikke og eit lite handkle å sitje på.",
        },
        {
          heading: "Varme, kjøl ned, gjenta",
          body: "Kast ei ause vatn på dei varme steinane for ei bølgje av damp, det finnane kallar löyly. Ver der så lenge det kjennest godt, kjøl deg ned i vatnet, sjøen eller dusjen, kvil litt og gå inn att. To eller tre rundar er vanleg.",
        },
        {
          heading: "Badstoveskikk",
          body: "Dusj før du går inn. Familiar badar ofte nakne, og badetøy går fint blant vener. La aldri ein vedomn stå utan tilsyn medan det brenn, og spør eigaren korleis dei vil at badstova skal forlatast.",
        },
      ],
    },
    aurora: {
      title: "Når og kvar du ser nordlyset",
      lead: "Mørk og klar himmel tyder meir enn flaks. Slik gjev du deg sjølv dei beste sjansane.",
      sections: [
        {
          heading: "Når du bør reise",
          body: "Sesongen varer om lag frå slutten av august til byrjinga av april, når nettene er mørke nok. Timane rundt midnatt er ofte best, men nordlyset kan dukke opp når som helst det er mørkt.",
        },
        {
          heading: "Kvar du bør bu",
          body: "Jo lenger nord du er, jo oftare ser du det. I finsk og svensk Lappland, Nord-Noreg og på Island viser det seg mange klare netter; i Sør-Finland og Baltikum berre når aktiviteten er sterk.",
        },
        {
          heading: "Slik ser du det",
          body: "Kom deg bort frå lys: ei open strand ved vatnet eller ein fjelltopp er ideelt. Sjekk skyvarselet og eit nordlysvarsel, kle deg varmt og gje auga eit kvarter til å venje seg til mørkret. Eit mobilkamera i nattmodus ser ofte meir enn deg.",
        },
      ],
    },
    everyman: {
      title: "Allemannsretten: ferdsel, bær og bål",
      lead: "I Finland, Sverige, Noreg og Estland er naturen open for alle, så lenge du følgjer nokre enkle reglar.",
      sections: [
        {
          heading: "Dette kan du gjere",
          body: "Du kan gå, gå på ski og sykle i skog og mark, bade i innsjøar og i sjøen og plukke ville bær, sopp og blomar som ikkje er freda, også på eigedom som andre eig.",
        },
        {
          heading: "Hugs dette",
          body: "Hald god avstand til hus og hagar, ikkje forstyrr dyr eller hekkande fuglar, ikkje skad levande tre, og ta med deg boset.",
        },
        {
          heading: "Bål og fiske",
          body: "Bål på eigedomen til andre krev som regel løyve frå grunneigaren, og bålforbod gjeld når det er tørt. Enkelt stongfiske er gratis mange stader, men anna fiske krev fiskekort. Reglane er ulike frå land til land, så spør eigaren av hytta.",
        },
      ],
    },
    midsummer: {
      title: "Sankthans på hytta",
      lead: "Dei lengste dagane i året er den kjæraste høgtida i Norden, og mange er på hytta då.",
      sections: [
        {
          heading: "Når det er",
          body: "I Finland og Sverige er midtsommaraftan fredagen mellom 19. og 25. juni. Noreg og Danmark feirar sankthans 23. juni, og Estland, Latvia og Litauen har sine eigne midtsommarfestar 23. og 24. juni.",
        },
        {
          heading: "Slik vert det feira",
          body: "Bål ved vatnet, badstove, nypoteter og sild, blomekransar og dans, alt etter land. Nord for polarsirkelen går ikkje sola ned i det heile.",
        },
        {
          heading: "Planlegg i god tid",
          body: "Midtsommar er ei av dei travlaste vekene for hytter, og mange butikkar stengjer eller har korte opningstider i høgtida. Bestill tidleg og handle maten før aftanen.",
        },
      ],
    },
    winter: {
      title: "Den første vinterhytta di",
      lead: "Snø, stille og ein varm peis. Nokre få ting gjer vinteropphaldet enklare.",
      sections: [
        {
          heading: "Å kome seg dit",
          body: "Sjekk at vegen til hytta er brøytt, og om du kan parkere nær døra. Vinterdekk er påbode om vinteren i det meste av regionen, og leigebilar har dei.",
        },
        {
          heading: "Hald varmen",
          body: "Mange hytter vert haldne berre så vidt over frysepunktet når dei står tomme, så det kan ta nokre timar før det vert varmt. Spør eigaren korleis varmen og peisen fungerer, og kvar veden er.",
        },
        {
          heading: "Korte dagar",
          body: "I desember er sola oppe berre nokre timar i sør og ikkje i det heile lengst nord. Planlegg tida ute etter lyset, ta med hovudlykt og nyt skinet frå snøen.",
        },
      ],
    },
  },
};
