import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Vaata {n} puhkemaja", other: "Vaata {n} puhkemaja" },
  seasons: {
    summer: "Suvi",
    autumn: "Hilissuvi ja sügis",
    winter: "Talv",
    allYear: "Aasta ringi",
  },

  experiences: {
    meta: {
      title: "Mida teha Põhjamaade puhkemajas | Rantio",
      description: "Saun, ujumine, aerutamine, kalapüük, matkamine, suusatamine ja virmalised: leia puhkemaja selle järgi, mida tahad teha.",
    },
    title: "Mida puhkemajas teha",
    lead: "Saun järve ääres, aerutamine pikas õhtuvalguses, suusatamine ja virmalised. Vali, mida tahad teha, ja vaata sinna sobivaid puhkemaju.",
    note: "Rantio ei müü elamusi. Omanik oskab öelda, mis on lähedal, ja kohalikud giidid võtavad vastu broneeringuid näiteks koerarakendisõitudele ja virmaliste retkedele.",
    items: {
      sauna: {
        title: "Saun ja jahutav suplus",
        body: "Soojenda end puhkemaja oma saunas ja jahuta end järves või meres. Talvel lähevad julgemad jääauku.",
      },
      swim: {
        title: "Ujumine oma kaldalt",
        body: "Paljud puhkemajad asuvad otse vee ääres, sild või liivarand on uksest vaid mõne sammu kaugusel.",
      },
      paddling: {
        title: "Kanuu ja aerutamine",
        body: "Vaiksed järved ja varjulised lahesopid on otsekui kanuu jaoks loodud. Nendes puhkemajades ootab see sind.",
      },
      fishing: {
        title: "Kalapüük paadist",
        body: "Sõua õhtul järvele või püüa talvel kala läbi jää. Lihtne õngepüük on paljudes kohtades tasuta, muu kalapüük nõuab luba.",
      },
      hiking: {
        title: "Metsarajad ja metsamarjad",
        body: "Rajad algavad uksest. Juulist alates võid igaüheõiguse alusel korjata mustikaid, pohli ja seeni.",
      },
      aurora: {
        title: "Virmalised",
        body: "Augusti lõpust aprilli alguseni pakub Lapimaa, Põhja-Norra ja Islandi pime taevas parimaid võimalusi.",
      },
      skiing: {
        title: "Mäesuusatamine ja murdmaasuusatamine",
        body: "Ööbi nõlvade lähedal või mine suusarajale, mis kulgeb puhkemajast mööda.",
      },
      dogs: {
        title: "Puhkus koos koeraga",
        body: "Ruumi joosta ja omanikud, kes ootavad ka neljajalgseid külalisi. Vaata enne broneerimist puhkemaja enda reegleid.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Puhkemajade sihtkohad Põhjamaades ja Baltikumis | Rantio",
      description: "Soome, Rootsi, Norra, Taani, Island, Eesti, Läti ja Leedu: järved, fjordid, luited ja metsad ning sealsed puhkemajad.",
    },
    title: "Sihtkohad",
    lead: "Kaheksa riiki Läänemere ja Põhja-Atlandi ümber, igaühes oma moodi puhkemajad.",
    regions: "Puhkemajad piirkondades",
    allIn: "Kõik puhkemajad: {country}",
    countries: {
      FI: "Tuhanded järved, saun peaaegu igas puhkemajas ning Lapimaa lumi ja virmalised.",
      SE: "Punased puitmajad sügaval metsas, saartest täis rannik ja mäed põhjas.",
      NO: "Fjordid, kaluritemajad kaldal ja mäed, mis laskuvad otse merre.",
      DK: "Luitemajad pikkade liivarandade taga, Põhjameri vaid lühikese jalutuskäigu kaugusel.",
      IS: "Fjordid, kuumaveeallikad ja avar taevas, mis on talvel virmaliste jaoks piisavalt pime.",
      EE: "Vaiksed saared, kadakased karjamaad ja suitsusaun, vana Eesti traditsioon.",
      LV: "Latgale järvemaa, männimetsad ja pikk liivane Läänemere rannik.",
      LT: "Kura säär oma luidetega, õlgkatusega talud ja vaiksed maajärved.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiratsiooni puhkemaja reisiks | Rantio",
      description: "Lühikesed juhendid sauna, virmaliste, igaüheõiguse, jaanipäeva ja talvise puhkemaja kohta Põhjamaades.",
    },
    title: "Inspiratsioon",
    lead: "Lühikesed juhendid puhkemaja reisiks, saunast virmalisteni.",
    read: "Loe juhendit",
    minutes: { one: "Lugemisaeg {n} min", other: "Lugemisaeg {n} min" },
    back: "Kõik juhendid",
    ctaTitle: "Leia selleks sobiv puhkemaja",
    more: "Veel juhendeid",
  },

  guides: {
    sauna: {
      title: "Kuidas saunas käia nagu kohalik",
      lead: "Puhkemaja saun on Põhjamaade õhtu süda ja see on lihtsam, kui paistab.",
      sections: [
        {
          heading: "Küta saun soojaks",
          body: "Puuküttega saun läheb soojaks umbes tunniga, elektrikeris 30–45 minutiga. Umbes 70–80 °C on täiesti piisav. Võta kaasa midagi juua ja väike rätik, mille peal istuda.",
        },
        {
          heading: "Leil, jahutus ja uuesti",
          body: "Viska kulbitäis vett kuumadele kividele ja saad leili, mida soomlased kutsuvad löyly'ks. Ole laval nii kaua, kui hea on, jahuta end siis järves, meres või duši all, puhka natuke ja mine tagasi. Kaks või kolm korda on tavaline.",
        },
        {
          heading: "Saunakombed",
          body: "Käi enne sauna minekut duši all. Pered saunatavad sageli alasti, sõprade seas sobib ka ujumisriietus. Ära jäta puukerist järelevalveta, kui tuli põleb, ja küsi omanikult, kuidas ta tahab, et saun maha jäetaks.",
        },
      ],
    },
    aurora: {
      title: "Millal ja kus näeb virmalisi",
      lead: "Pime ja selge taevas loeb rohkem kui õnn. Nii annad endale parimad võimalused.",
      sections: [
        {
          heading: "Millal minna",
          body: "Hooaeg kestab umbes augusti lõpust aprilli alguseni, kui ööd on piisavalt pimedad. Kesköö paiku on sageli parim aeg, kuid virmalised võivad ilmuda igal ajal, kui on pime.",
        },
        {
          heading: "Kus ööbida",
          body: "Mida põhja pool oled, seda sagedamini neid näed. Soome ja Rootsi Lapimaal, Põhja-Norras ja Islandil on neid näha paljudel selgetel öödel; Lõuna-Soomes ja Baltikumis ainult tugeva aktiivsuse ajal.",
        },
        {
          heading: "Kuidas vaadata",
          body: "Mine tuledest eemale: lage järvekallas või mäetipp on ideaalne. Vaata pilvisuse ja virmaliste prognoosi, riietu soojalt ja anna silmadele veerand tundi harjumiseks. Telefoni kaamera öörežiimis näeb sageli rohkem kui sina.",
        },
      ],
    },
    everyman: {
      title: "Igaüheõigus: liikumine, marjad ja lõkked",
      lead: "Soomes, Rootsis, Norras ja Eestis on loodus kõigile avatud, kui järgid mõnda lihtsat reeglit.",
      sections: [
        {
          heading: "Mida võid teha",
          body: "Võid metsas ja põllul jalutada, suusatada ja rattaga sõita, ujuda järvedes ja meres ning korjata metsamarju, seeni ja kaitse alla mittekuuluvaid lilli ka teise inimese maal.",
        },
        {
          heading: "Mida meeles pidada",
          body: "Hoia kodudest ja aedadest lugupidavat kaugust, ära häiri loomi ega pesitsevaid linde, ära kahjusta elusaid puid ja vii prügi endaga kaasa.",
        },
        {
          heading: "Lõkked ja kalapüük",
          body: "Lõkke tegemiseks teise maal on tavaliselt vaja maaomaniku luba ja kuiva ilmaga kehtib tuleohtlik aeg. Lihtne õngepüük on paljudes kohtades tasuta, muu kalapüük nõuab luba. Reeglid on riigiti erinevad, nii et küsi puhkemaja omanikult.",
        },
      ],
    },
    midsummer: {
      title: "Jaanipäev puhkemajas",
      lead: "Aasta pikimad päevad on Põhjamaade armsaim püha ja paljud veedavad need puhkemajas.",
      sections: [
        {
          heading: "Millal see on",
          body: "Soomes ja Rootsis on jaanilaupäev reede vahemikus 19.–25. juuni. Norra ja Taani tähistavad sankthansi 23. juunil ning Eestis, Lätis ja Leedus peetakse oma jaanipidu 23. ja 24. juunil.",
        },
        {
          heading: "Kuidas tähistatakse",
          body: "Lõkked vee ääres, saun, uued kartulid ja heeringas, lillepärjad ja tants, olenevalt riigist. Põhjapolaarjoonest põhja pool ei lähe päike üldse looja.",
        },
        {
          heading: "Planeeri aegsasti",
          body: "Jaanipäev on puhkemajade üks kiiremaid nädalaid ja paljud poed on pühade ajal kinni või lühema lahtiolekuajaga. Broneeri varakult ja osta toit enne jaanilaupäeva.",
        },
      ],
    },
    winter: {
      title: "Sinu esimene talvine puhkemaja",
      lead: "Lumi, vaikus ja soe kaminatuli. Mõni asi teeb talvise puhkuse lihtsamaks.",
      sections: [
        {
          heading: "Kohale jõudmine",
          body: "Veendu, et tee puhkemajani on lahti lükatud ja kas saad autoga ukse lähedale. Talvel on talverehvid suuremas osas piirkonnast kohustuslikud ja rendiautodel on need olemas.",
        },
        {
          heading: "Hoia end soojas",
          body: "Paljusid puhkemaju hoitakse tühjana vaid veidi üle nulli, nii et soojaks minek võib võtta mõne tunni. Küsi omanikult, kuidas küte ja kamin töötavad ning kus on küttepuud.",
        },
        {
          heading: "Lühikesed päevad",
          body: "Detsembris on päike lõunas taevas vaid mõne tunni ja kaugel põhjas üldse mitte. Planeeri õues olemine valge aja järgi, võta kaasa pealamp ja naudi lume kuma.",
        },
      ],
    },
  },
};
