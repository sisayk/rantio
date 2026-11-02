import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: {
    one: "Žiūrėti {n} namelį",
    few: "Žiūrėti {n} namelius",
    many: "Žiūrėti {n} namelio",
    other: "Žiūrėti {n} namelių",
  },
  seasons: {
    summer: "Vasara",
    autumn: "Vasaros pabaiga ir ruduo",
    winter: "Žiema",
    allYear: "Visus metus",
  },

  experiences: {
    meta: {
      title: "Ką veikti Šiaurės šalių poilsio namelyje | Rantio",
      description: "Pirtis, maudynės, irklavimas, žvejyba, žygiai, slidinėjimas ir šiaurės pašvaistė: raskite namelį tam, ką norite veikti.",
    },
    title: "Ką veikti namelyje",
    lead: "Pirtis prie ežero, irklavimas ilgoje vakaro šviesoje, slidinėjimas ir šiaurės pašvaistė. Pasirinkite, ką norite veikti, ir pažiūrėkite tinkamus namelius.",
    note: "Rantio nepardavinėja pramogų. Šeimininkas papasakos, kas yra netoliese, o vietiniai gidai priima užsakymus, pavyzdžiui, pasivažinėjimams šunų kinkiniais ir šiaurės pašvaistės išvykoms.",
    items: {
      sauna: {
        title: "Pirtis ir gaivus pasinėrimas",
        body: "Sušilkite namelio pirtyje ir atvėskite ežere ar jūroje. Žiemą drąsiausieji neria į eketę.",
      },
      swim: {
        title: "Maudynės nuo savo kranto",
        body: "Daug namelių stovi pačiame vandens krante, su lieptu ar smėlio paplūdimiu vos keli žingsniai nuo durų.",
      },
      paddling: {
        title: "Kanoja ir irklavimas",
        body: "Ramūs ežerai ir užuovėjos įlankos tarsi sukurti kanojai. Šiuose nameliuose ji jūsų jau laukia.",
      },
      fishing: {
        title: "Žvejyba iš valties",
        body: "Išplaukite vakare arba žiemą žvejokite pro ledą. Paprasta žvejyba meškere daug kur nemokama, bet kitai žvejybai reikia leidimo.",
      },
      hiking: {
        title: "Pasivaikščiojimai miške ir miško uogos",
        body: "Takai prasideda prie durų. Nuo liepos galite rinkti mėlynes, bruknes ir grybus pagal kiekvieno teisę.",
      },
      aurora: {
        title: "Šiaurės pašvaistė",
        body: "Nuo rugpjūčio pabaigos iki balandžio pradžios tamsus dangus Laplandijoje, Šiaurės Norvegijoje ir Islandijoje suteikia geriausias galimybes.",
      },
      skiing: {
        title: "Kalnų ir lygumų slidinėjimas",
        body: "Apsistokite netoli šlaitų arba leiskitės lygumų slidinėjimo trasomis, kurios eina pro namelį.",
      },
      dogs: {
        title: "Atostogos su šunimi",
        body: "Daug vietos lakstyti ir šeimininkai, kurie laukia ir keturkojų svečių. Prieš užsisakydami pasitikrinkite namelio taisykles.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Poilsio namelių kryptys Šiaurės ir Baltijos šalyse | Rantio",
      description: "Suomija, Švedija, Norvegija, Danija, Islandija, Estija, Latvija ir Lietuva: ežerai, fjordai, kopos ir miškai bei ten esantys nameliai.",
    },
    title: "Kryptys",
    lead: "Aštuonios šalys aplink Baltijos jūrą ir Šiaurės Atlantą, kiekvienoje savitas poilsio namelis.",
    regions: "Nameliai regionuose",
    allIn: "Visi nameliai: {country}",
    countries: {
      FI: "Tūkstančiai ežerų, pirtis beveik prie kiekvieno namelio, Laplandijos sniegas ir šiaurės pašvaistė.",
      SE: "Raudoni mediniai nameliai giliai miške, uolėtų salelių pakrantė ir kalnai šiaurėje.",
      NO: "Fjordai, žvejų nameliai pakrantėje ir kalnai, krentantys tiesiai į jūrą.",
      DK: "Kopų nameliai už ilgų smėlio paplūdimių, iki Šiaurės jūros tik trumpas pasivaikščiojimas.",
      IS: "Fjordai, karštieji šaltiniai ir platus dangus, žiemą pakankamai tamsus šiaurės pašvaistei.",
      EE: "Ramios salos, kadagių pievos ir dūminė pirtis, sena estų tradicija.",
      LV: "Latgalos ežerų kraštas, pušynai ir ilga smėlėta Baltijos pakrantė.",
      LT: "Kuršių nerijos kopos, šiaudiniais stogais dengtos sodybos ir ramūs kaimo ežerai.",
    },
  },

  inspiration: {
    meta: {
      title: "Įkvėpimas atostogoms namelyje | Rantio",
      description: "Trumpi gidai apie pirtį, šiaurės pašvaistę, kiekvieno teisę, Jonines ir žiemą Šiaurės šalių namelyje.",
    },
    title: "Įkvėpimas",
    lead: "Trumpi gidai atostogoms namelyje, nuo pirties iki šiaurės pašvaistės.",
    read: "Skaityti gidą",
    minutes: { one: "{n} min. skaitymo", few: "{n} min. skaitymo", many: "{n} min. skaitymo", other: "{n} min. skaitymo" },
    back: "Visi gidai",
    ctaTitle: "Raskite tam tinkamą namelį",
    more: "Daugiau gidų",
  },

  guides: {
    sauna: {
      title: "Kaip pertis kaip vietiniai",
      lead: "Namelio pirtis yra Šiaurės vakaro širdis, ir tai paprasčiau, nei atrodo.",
      sections: [
        {
          heading: "Įkaitinkite pirtį",
          body: "Malkomis kūrenama pirtis įkaista maždaug per valandą, elektrinė per 30–45 minutes. Užtenka maždaug 70–80 °C. Pasiimkite atsigerti ir mažą rankšluostį, ant kurio sėdėsite.",
        },
        {
          heading: "Karštis, atvėsimas ir vėl",
          body: "Užpilkite samtį vandens ant karštų akmenų ir pajusite garo bangą, kurią suomiai vadina löyly. Būkite tiek, kiek malonu, tada atvėskite ežere, jūroje ar po dušu, truputį pailsėkite ir grįžkite. Įprasta du ar trys kartai.",
        },
        {
          heading: "Pirties etiketas",
          body: "Prieš eidami į pirtį nusiprauskite po dušu. Šeimos dažnai periasi nuogos, o tarp draugų tinka ir maudymosi kostiumėlis. Niekada nepalikite malkinės krosnies be priežiūros, kol dega ugnis, ir paklauskite šeimininko, kaip palikti pirtį.",
        },
      ],
    },
    aurora: {
      title: "Kada ir kur pamatyti šiaurės pašvaistę",
      lead: "Tamsus ir giedras dangus reiškia daugiau nei sėkmė. Štai kaip pasididinti galimybes.",
      sections: [
        {
          heading: "Kada vykti",
          body: "Sezonas trunka maždaug nuo rugpjūčio pabaigos iki balandžio pradžios, kai naktys pakankamai tamsios. Valandos apie vidurnaktį dažnai geriausios, bet pašvaistė gali pasirodyti bet kada, kai tamsu.",
        },
        {
          heading: "Kur apsistoti",
          body: "Kuo toliau į šiaurę, tuo dažniau ją pamatysite. Suomijos ir Švedijos Laplandijoje, Šiaurės Norvegijoje ir Islandijoje ji matoma daugelį giedrų naktų; Pietų Suomijoje ir Baltijos šalyse tik esant stipriam aktyvumui.",
        },
        {
          heading: "Kaip stebėti",
          body: "Pasitraukite nuo šviesų: atviras ežero krantas ar kalno viršūnė yra idealu. Patikrinkite debesuotumo ir pašvaistės prognozes, šiltai apsirenkite ir duokite akims ketvirtį valandos priprasti. Telefono kamera nakties režimu dažnai mato daugiau nei jūs.",
        },
      ],
    },
    everyman: {
      title: "Kiekvieno teisė: judėjimas, uogos ir laužai",
      lead: "Suomijoje, Švedijoje, Norvegijoje ir Estijoje gamta atvira visiems, jei laikotės kelių paprastų taisyklių.",
      sections: [
        {
          heading: "Ką galima daryti",
          body: "Galite vaikščioti, slidinėti ir važiuoti dviračiu miškais ir laukais, maudytis ežeruose ir jūroje bei rinkti miško uogas, grybus ir nesaugomas gėles net ir kitam priklausančioje žemėje.",
        },
        {
          heading: "Ką reikia prisiminti",
          body: "Laikykitės pagarbaus atstumo nuo namų ir sodų, netrikdykite gyvūnų ir perinčių paukščių, nežalokite augančių medžių ir išsineškite savo šiukšles.",
        },
        {
          heading: "Laužai ir žvejyba",
          body: "Laužui kito žemėje paprastai reikia savininko leidimo, o sausu oru galioja draudimai kurti ugnį. Paprasta žvejyba meškere daug kur nemokama, bet kitai žvejybai reikia leidimo. Taisyklės skirtingose šalyse skiriasi, todėl paklauskite namelio šeimininko.",
        },
      ],
    },
    midsummer: {
      title: "Joninės namelyje",
      lead: "Ilgiausios metų dienos yra mylimiausia Šiaurės šventė, ir daugelis jas praleidžia namelyje.",
      sections: [
        {
          heading: "Kada jos būna",
          body: "Suomijoje ir Švedijoje Joninių išvakarės yra penktadienis tarp birželio 19 ir 25 dienos. Norvegijoje ir Danijoje Sankthansas švenčiamas birželio 23-iąją, o Estija, Latvija ir Lietuva savo vasaros šventes švenčia birželio 23 ir 24 dienomis.",
        },
        {
          heading: "Kaip jos švenčiamos",
          body: "Laužai prie vandens, pirtis, jaunos bulvės ir silkė, gėlių vainikai ir šokiai, priklausomai nuo šalies. Už poliarinio rato saulė visai nenusileidžia.",
        },
        {
          heading: "Planuokite iš anksto",
          body: "Joninės yra viena užimčiausių savaičių nameliuose, o daug parduotuvių per šventes nedirba arba dirba trumpiau. Užsisakykite anksti ir apsipirkite prieš Joninių išvakares.",
        },
      ],
    },
    winter: {
      title: "Jūsų pirmasis žiemos namelis",
      lead: "Sniegas, tyla ir šilta ugnis židinyje. Keli dalykai palengvina žiemos atostogas.",
      sections: [
        {
          heading: "Kaip nuvykti",
          body: "Įsitikinkite, kad kelias iki namelio nuvalytas, ir sužinokite, ar galima pastatyti automobilį prie durų. Žiemą daugumoje regiono žieminės padangos privalomos, o nuomojami automobiliai jas turi.",
        },
        {
          heading: "Kaip nesušalti",
          body: "Daug namelių, kol jie tušti, šildomi tik šiek tiek virš nulio, todėl įšilti gali užtrukti kelias valandas. Paklauskite šeimininko, kaip veikia šildymas ir židinys ir kur rasti malkų.",
        },
        {
          heading: "Trumpos dienos",
          body: "Gruodį pietuose saulė danguje būna tik kelias valandas, o tolimojoje šiaurėje visai nepakyla. Planuokite laiką lauke pagal šviesą, pasiimkite žibintuvėlį ant kaktos ir mėgaukitės sniego švytėjimu.",
        },
      ],
    },
  },
};
