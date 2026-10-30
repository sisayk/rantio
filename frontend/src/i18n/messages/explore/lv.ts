import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { zero: "Skatīt {n} brīvdienu māju", one: "Skatīt {n} brīvdienu māju", other: "Skatīt {n} brīvdienu mājas" },
  seasons: {
    summer: "Vasara",
    autumn: "Vasaras beigas un rudens",
    winter: "Ziema",
    allYear: "Visu gadu",
  },

  experiences: {
    meta: {
      title: "Ko darīt Ziemeļvalstu brīvdienu mājā | Stugora",
      description: "Pirts, peldēšana, airēšana, makšķerēšana, pārgājieni, slēpošana un ziemeļblāzma: atrodiet brīvdienu māju tam, ko vēlaties darīt.",
    },
    title: "Ko darīt brīvdienu mājā",
    lead: "Pirts pie ezera, airēšana garajā vakara gaismā, slēpošana un ziemeļblāzma. Izvēlieties, ko vēlaties darīt, un skatiet piemērotās mājas.",
    note: "Stugora nepārdod piedzīvojumus. Saimnieks pastāstīs, kas atrodas tuvumā, un vietējie gidi pieņem rezervācijas, piemēram, braucieniem ar suņu pajūgu un ziemeļblāzmas ekskursijām.",
    items: {
      sauna: {
        title: "Pirts un atveldzējoša peldēšanās",
        body: "Sasildieties mājas pašas pirtī un atvēsinieties ezerā vai jūrā. Ziemā drosmīgākie nirst āliņģī.",
      },
      swim: {
        title: "Peldēšanās no sava krasta",
        body: "Daudzas mājas atrodas pašā ūdens malā, ar laipu vai smilšu pludmali dažu soļu attālumā no durvīm.",
      },
      paddling: {
        title: "Kanoe un airēšana",
        body: "Mierīgi ezeri un aizvēja līči ir kā radīti kanoe laivai. Šajās mājās tā jūs jau gaida.",
      },
      fishing: {
        title: "Makšķerēšana no laivas",
        body: "Izairējiet vakarā vai ziemā makšķerējiet caur ledu. Vienkārša makšķerēšana daudzviet ir bez maksas, bet citai zvejai vajadzīga licence.",
      },
      hiking: {
        title: "Pastaigas mežā un meža ogas",
        body: "Takas sākas pie durvīm. No jūlija varat lasīt mellenes, brūklenes un sēnes saskaņā ar ikviena tiesībām.",
      },
      aurora: {
        title: "Ziemeļblāzma",
        body: "No augusta beigām līdz aprīļa sākumam tumšās debesis Lapzemē, Norvēģijas ziemeļos un Islandē dod labākās izredzes.",
      },
      skiing: {
        title: "Kalnu un distanču slēpošana",
        body: "Apmetieties pie nogāzēm vai dodieties pa distanču trasēm, kas ved garām mājai.",
      },
      dogs: {
        title: "Atpūta kopā ar suni",
        body: "Plaša vieta skraidīšanai un saimnieki, kas gaida arī četrkājainos viesus. Pirms rezervēšanas pārbaudiet mājas noteikumus.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Brīvdienu māju galamērķi Ziemeļvalstīs un Baltijā | Stugora",
      description: "Somija, Zviedrija, Norvēģija, Dānija, Islande, Igaunija, Latvija un Lietuva: ezeri, fjordi, kāpas un meži un tur esošās brīvdienu mājas.",
    },
    title: "Galamērķi",
    lead: "Astoņas valstis ap Baltijas jūru un Ziemeļatlantiju, katrā savas brīvdienu mājas.",
    regions: "Mājas reģionos",
    allIn: "Visas brīvdienu mājas: {country}",
    countries: {
      FI: "Tūkstošiem ezeru, pirts gandrīz katrā mājā, Lapzemes sniegs un ziemeļblāzma.",
      SE: "Sarkanas koka mājiņas dziļi mežā, šhēru krasts un kalni ziemeļos.",
      NO: "Fjordi, zvejnieku mājiņas krastā un kalni, kas krīt tieši jūrā.",
      DK: "Kāpu mājas aiz garām smilšu pludmalēm, līdz Ziemeļjūrai tikai īss gājiens.",
      IS: "Fjordi, karstie avoti un plašas debesis, kas ziemā ir pietiekami tumšas ziemeļblāzmai.",
      EE: "Klusas salas, kadiķu pļavas un dūmu pirts, sena igauņu tradīcija.",
      LV: "Latgales ezeru zeme, priežu meži un gara smilšaina Baltijas jūras piekraste.",
      LT: "Kuršu kāpas, lauku sētas ar salmu jumtiem un mierīgi lauku ezeri.",
    },
  },

  inspiration: {
    meta: {
      title: "Iedvesma brīvdienām lauku mājā | Stugora",
      description: "Īsi ceļveži par pirti, ziemeļblāzmu, ikviena tiesībām, Jāņiem un ziemu Ziemeļvalstu brīvdienu mājā.",
    },
    title: "Iedvesma",
    lead: "Īsi ceļveži brīvdienām lauku mājā, no pirts līdz ziemeļblāzmai.",
    read: "Lasīt ceļvedi",
    minutes: { zero: "Lasīšanai {n} min", one: "Lasīšanai {n} min", other: "Lasīšanai {n} min" },
    back: "Visi ceļveži",
    ctaTitle: "Atrodiet tam piemērotu māju",
    more: "Vēl ceļveži",
  },

  guides: {
    sauna: {
      title: "Kā iet pirtī kā vietējie",
      lead: "Mājas pirts ir Ziemeļu vakara sirds, un tas ir vienkāršāk, nekā izskatās.",
      sections: [
        {
          heading: "Sakuriniet pirti",
          body: "Ar malku kurināma pirts uzsilst apmēram stundā, elektriskā 30–45 minūtēs. Ar 70–80 °C pilnīgi pietiek. Paņemiet līdzi ko padzerties un nelielu dvieli, uz kā sēdēt.",
        },
        {
          heading: "Karstums, atvēsināšanās, atkārtot",
          body: "Uzlejiet uz karstajiem akmeņiem kausu ūdens, lai rastos tvaika vilnis, ko somi sauc par löyly. Palieciet tik ilgi, cik patīkami, tad atvēsinieties ezerā, jūrā vai dušā, mazliet atpūtieties un ejiet atpakaļ. Parasti tās ir divas vai trīs reizes.",
        },
        {
          heading: "Pirts paražas",
          body: "Pirms ieiešanas nomazgājieties dušā. Ģimenes bieži pērtās kailas, draugu vidū derēs arī peldkostīms. Nekad neatstājiet malkas krāsni bez uzraudzības, kamēr deg uguns, un pajautājiet saimniekam, kādā stāvoklī atstāt pirti.",
        },
      ],
    },
    aurora: {
      title: "Kad un kur redzēt ziemeļblāzmu",
      lead: "Tumšas, skaidras debesis nozīmē vairāk nekā veiksme. Lūk, kā sev dot labākās izredzes.",
      sections: [
        {
          heading: "Kad doties",
          body: "Sezona ilgst aptuveni no augusta beigām līdz aprīļa sākumam, kad naktis ir pietiekami tumšas. Stundas ap pusnakti bieži ir labākās, bet blāzma var parādīties jebkurā laikā, kad ir tumšs.",
        },
        {
          heading: "Kur apmesties",
          body: "Jo tālāk uz ziemeļiem esat, jo biežāk to redzēsiet. Somijas un Zviedrijas Lapzemē, Norvēģijas ziemeļos un Islandē tā redzama daudzās skaidrās naktīs; Somijas dienvidos un Baltijā tikai spēcīgas aktivitātes laikā.",
        },
        {
          heading: "Kā vērot",
          body: "Dodieties prom no gaismām: atklāts ezera krasts vai kalna virsotne ir ideāla vieta. Pārbaudiet mākoņu un ziemeļblāzmas prognozi, saģērbieties silti un ļaujiet acīm ceturtdaļstundu pierast. Tālruņa kamera nakts režīmā bieži redz vairāk nekā jūs.",
        },
      ],
    },
    everyman: {
      title: "Ikviena tiesības: pārvietošanās, ogas un ugunskuri",
      lead: "Somijā, Zviedrijā, Norvēģijā un Igaunijā daba ir atvērta ikvienam, ja ievērojat dažus vienkāršus noteikumus.",
      sections: [
        {
          heading: "Ko drīkst darīt",
          body: "Jūs drīkstat staigāt, slēpot un braukt ar velosipēdu mežos un laukos, peldēties ezeros un jūrā un lasīt meža ogas, sēnes un neaizsargātus ziedus arī uz citam piederošas zemes.",
        },
        {
          heading: "Kas jāatceras",
          body: "Ievērojiet cieņpilnu attālumu no mājām un dārziem, netraucējiet dzīvniekus un ligzdojošus putnus, nebojājiet augošus kokus un aiznesiet savus atkritumus līdzi.",
        },
        {
          heading: "Ugunskuri un makšķerēšana",
          body: "Ugunskuram uz citam piederošas zemes parasti vajadzīga zemes īpašnieka atļauja, un sausā laikā ir spēkā ugunsdrošības aizliegumi. Vienkārša makšķerēšana daudzviet ir bez maksas, bet citai zvejai vajadzīga licence. Noteikumi katrā valstī atšķiras, tāpēc pajautājiet mājas saimniekam.",
        },
      ],
    },
    midsummer: {
      title: "Jāņi brīvdienu mājā",
      lead: "Gada garākās dienas ir Ziemeļu mīļākie svētki, un daudzi tās pavada lauku mājā.",
      sections: [
        {
          heading: "Kad tie ir",
          body: "Somijā un Zviedrijā Jāņu vakars ir piektdiena laikā no 19. līdz 25. jūnijam. Norvēģijā un Dānijā svin Sankthansu 23. jūnijā, bet Igaunijā, Latvijā un Lietuvā savus vasaras saulgriežu svētkus svin 23. un 24. jūnijā.",
        },
        {
          heading: "Kā tos svin",
          body: "Ugunskuri pie ūdens, pirts, jaunie kartupeļi un siļķe, ziedu vainagi un dejas, atkarībā no valsts. Aiz polārā loka saule vispār nenoriet.",
        },
        {
          heading: "Plānojiet laikus",
          body: "Jāņi ir viena no aizņemtākajām nedēļām brīvdienu mājās, un daudzi veikali svētkos ir slēgti vai strādā īsāku laiku. Rezervējiet agri un iepērcieties pirms Jāņu vakara.",
        },
      ],
    },
    winter: {
      title: "Jūsu pirmā ziemas brīvdienu māja",
      lead: "Sniegs, klusums un silts uguns kamīnā. Dažas lietas padara ziemas atpūtu vieglāku.",
      sections: [
        {
          heading: "Kā nokļūt",
          body: "Pārliecinieties, ka ceļš līdz mājai ir notīrīts, un uzziniet, vai var novietot auto pie durvīm. Ziemā lielākajā daļā reģiona ziemas riepas ir obligātas, un nomas auto tās ir.",
        },
        {
          heading: "Kā nesalt",
          body: "Daudzas mājas, kad tās stāv tukšas, tiek uzturētas tikai nedaudz virs nulles, tāpēc sasilšana var ilgt dažas stundas. Pajautājiet saimniekam, kā darbojas apkure un kamīns un kur atrodama malka.",
        },
        {
          heading: "Īsas dienas",
          body: "Decembrī saule dienvidos ir debesīs tikai dažas stundas, bet tālajos ziemeļos nemaz. Plānojiet laiku ārā pēc gaismas, paņemiet lukturīti uz pieres un baudiet sniega mirdzumu.",
        },
      ],
    },
  },
};
