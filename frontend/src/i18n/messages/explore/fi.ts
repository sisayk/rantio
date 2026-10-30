import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Näytä {n} mökki", other: "Näytä {n} mökkiä" },
  seasons: {
    summer: "Kesä",
    autumn: "Loppukesä ja syksy",
    winter: "Talvi",
    allYear: "Ympäri vuoden",
  },

  experiences: {
    meta: {
      title: "Tekemistä mökillä Pohjolassa | Stugora",
      description: "Saunaa, uintia, melontaa, kalastusta, retkeilyä, laskettelua ja revontulia: löydä mökki sen mukaan, mitä haluat tehdä.",
    },
    title: "Tekemistä mökillä",
    lead: "Saunaa järven rannalla, melontaa pitkässä illan valossa, hiihtoa ja revontulia. Valitse, mitä haluat tehdä, niin näet siihen sopivat mökit.",
    note: "Stugora ei myy elämyksiä. Omistaja kertoo, mitä lähellä on, ja paikalliset oppaat ottavat varauksia esimerkiksi huskyajeluille ja revontuliretkille.",
    items: {
      sauna: {
        title: "Sauna ja vilvoittava pulahdus",
        body: "Lämmittele mökin omassa saunassa ja vilvoittele järvessä tai meressä. Talvella rohkeimmat menevät avantoon.",
      },
      swim: {
        title: "Uimaan omalta rannalta",
        body: "Moni mökki on aivan vesirajassa, ja laituri tai hiekkaranta on muutaman askeleen päässä ovelta.",
      },
      paddling: {
        title: "Kanootilla ja melomassa",
        body: "Tyynet järvet ja suojaisat lahdet ovat kuin tehtyjä kanootille. Näillä mökeillä sellainen odottaa sinua.",
      },
      fishing: {
        title: "Kalaan veneellä",
        body: "Soudat illalla vesille tai pilkit talvella jäältä. Onkiminen ja pilkkiminen ovat monin paikoin vapaita, muuhun kalastukseen tarvitaan lupa.",
      },
      hiking: {
        title: "Metsäpolkuja ja metsämarjoja",
        body: "Polut alkavat ovelta. Heinäkuusta alkaen voit poimia mustikoita, puolukoita ja sieniä jokamiehenoikeuksin.",
      },
      aurora: {
        title: "Revontulet",
        body: "Elokuun lopusta huhtikuun alkuun Lapin, Pohjois-Norjan ja Islannin pimeät taivaat antavat parhaat mahdollisuudet.",
      },
      skiing: {
        title: "Laskettelua ja murtomaahiihtoa",
        body: "Majoitu lähellä rinteitä tai lähde laduille, jotka kulkevat mökin ohi.",
      },
      dogs: {
        title: "Lomalle koiran kanssa",
        body: "Tilaa liikkua ja omistajia, jotka toivottavat nelijalkaiset vieraat tervetulleiksi. Tarkista mökin omat säännöt ennen varausta.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Mökkikohteet Pohjoismaissa ja Baltiassa | Stugora",
      description: "Suomi, Ruotsi, Norja, Tanska, Islanti, Viro, Latvia ja Liettua: järviä, vuonoja, dyynejä ja metsiä sekä niiden mökit.",
    },
    title: "Kohteet",
    lead: "Kahdeksan maata Itämeren ja Pohjois-Atlantin ympärillä, ja jokaisessa omanlaisensa mökit.",
    regions: "Mökkejä alueilla",
    allIn: "Kaikki mökit: {country}",
    countries: {
      FI: "Tuhansia järviä, sauna lähes joka mökillä sekä Lapin lumi ja revontulet.",
      SE: "Punaisia puutupia syvällä metsässä, saariston rikkoma rannikko ja tunturit pohjoisessa.",
      NO: "Vuonoja, kalastajamökkejä rannassa ja vuoria, jotka laskeutuvat suoraan mereen.",
      DK: "Dyynimökkejä pitkien hiekkarantojen takana, ja Pohjanmeri lyhyen kävelymatkan päässä.",
      IS: "Vuonoja, kuumia lähteitä ja avaraa taivasta, joka on talvella tarpeeksi pimeä revontulille.",
      EE: "Rauhallisia saaria, katajaketoja ja savusauna, vanha virolainen perinne.",
      LV: "Latgalen järviseutu, mäntymetsät ja pitkä hiekkainen Itämeren rannikko.",
      LT: "Kuurinkynnäksen dyynit, olkikattoiset maatilat ja tyynet maalaisjärvet.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiraatiota mökkilomaan | Stugora",
      description: "Lyhyitä oppaita saunaan, revontuliin, jokamiehenoikeuksiin, juhannukseen ja talvimökkeilyyn Pohjolassa.",
    },
    title: "Inspiraatio",
    lead: "Lyhyitä oppaita mökkilomaan saunasta revontuliin.",
    read: "Lue opas",
    minutes: { one: "Lukuaika {n} min", other: "Lukuaika {n} min" },
    back: "Kaikki oppaat",
    ctaTitle: "Löydä siihen sopiva mökki",
    more: "Lisää oppaita",
  },

  guides: {
    sauna: {
      title: "Näin saunotaan kuin paikalliset",
      lead: "Mökkisauna on pohjoisen illan sydän, ja saunominen on helpompaa kuin miltä näyttää.",
      sections: [
        {
          heading: "Lämmitä sauna",
          body: "Puulämmitteinen sauna lämpenee noin tunnissa, sähkökiuas 30–45 minuutissa. Noin 70–80 °C riittää hyvin. Ota mukaan juotavaa ja pieni pyyhe tai laudeliina istuimeksi.",
        },
        {
          heading: "Löylyä, vilvoittelua, uudestaan",
          body: "Heitä kauhallinen vettä kuumille kiville, niin saat löylyä. Ole lauteilla niin kauan kuin tuntuu hyvältä, vilvoittele sitten järvessä, meressä tai suihkussa, lepää hetki ja palaa takaisin. Kaksi tai kolme kierrosta on tavallista.",
        },
        {
          heading: "Saunatavat",
          body: "Käy suihkussa ennen saunaan menoa. Perheet saunovat usein alasti, ja kavereiden kesken uima-asu käy hyvin. Älä jätä puukiuasta valvomatta, kun tuli palaa, ja kysy omistajalta, miten hän haluaa saunan jätettävän.",
        },
      ],
    },
    aurora: {
      title: "Milloin ja mistä näkee revontulet",
      lead: "Pimeä ja kirkas taivas ratkaisee enemmän kuin tuuri. Näin parannat mahdollisuuksiasi.",
      sections: [
        {
          heading: "Milloin lähteä",
          body: "Revontulikausi kestää suunnilleen elokuun lopusta huhtikuun alkuun, kun yöt ovat tarpeeksi pimeitä. Puolenyön tienoo on usein paras, mutta revontulia voi näkyä milloin tahansa, kun on pimeää.",
        },
        {
          heading: "Mihin majoittua",
          body: "Mitä pohjoisempana olet, sitä useammin niitä näkee. Suomen ja Ruotsin Lapissa, Pohjois-Norjassa ja Islannissa niitä näkyy monena kirkkaana yönä; Etelä-Suomessa ja Baltiassa vain voimakkaan aktiivisuuden aikaan.",
        },
        {
          heading: "Miten katsoa",
          body: "Mene pois valoista: avoin järvenranta tai tunturin laki on paras. Tarkista pilvisyysennuste ja revontuliennuste, pukeudu lämpimästi ja anna silmille vartti aikaa tottua. Puhelimen kamera yötilassa näkee usein enemmän kuin silmä.",
        },
      ],
    },
    everyman: {
      title: "Jokamiehenoikeudet: liikkumista, marjoja ja nuotioita",
      lead: "Suomessa, Ruotsissa, Norjassa ja Virossa luonto on kaikkien käytössä, kunhan noudatat muutamaa yksinkertaista sääntöä.",
      sections: [
        {
          heading: "Mitä saat tehdä",
          body: "Saat kävellä, hiihtää ja pyöräillä metsissä ja pelloilla, uida järvissä ja meressä sekä poimia luonnonmarjoja, sieniä ja rauhoittamattomia kukkia, myös toisen maalla.",
        },
        {
          heading: "Mitä muistaa",
          body: "Pidä kunnioittava etäisyys koteihin ja pihoihin, älä häiritse eläimiä tai pesiviä lintuja, älä vahingoita eläviä puita ja vie roskasi mukanasi.",
        },
        {
          heading: "Nuotiot ja kalastus",
          body: "Nuotion tekoon toisen maalle tarvitaan yleensä maanomistajan lupa, ja kuivalla säällä on voimassa metsäpalovaroituksia. Onkiminen ja pilkkiminen ovat monin paikoin vapaita, mutta muuhun kalastukseen tarvitaan lupa. Säännöt vaihtelevat maittain, joten kysy mökin omistajalta.",
        },
      ],
    },
    midsummer: {
      title: "Juhannus mökillä",
      lead: "Vuoden pisimmät päivät ovat Pohjolan rakkain juhla, ja moni viettää ne mökillä.",
      sections: [
        {
          heading: "Milloin se on",
          body: "Suomessa ja Ruotsissa juhannusaatto on 19.–25. kesäkuuta osuva perjantai. Norjassa ja Tanskassa vietetään sankthansia 23. kesäkuuta, ja Virolla, Latvialla ja Liettualla on omat juhannusjuhlansa 23. ja 24. kesäkuuta.",
        },
        {
          heading: "Miten sitä juhlitaan",
          body: "Kokkoja veden äärellä, saunaa, uusia perunoita ja silliä, kukkaseppeleitä ja tanssia, maasta riippuen. Napapiirin pohjoispuolella aurinko ei laske lainkaan.",
        },
        {
          heading: "Suunnittele ajoissa",
          body: "Juhannus on mökkien kiireisimpiä viikkoja, ja moni kauppa on kiinni tai auki lyhyemmin pyhien aikana. Varaa ajoissa ja osta ruoat ennen juhannusaattoa.",
        },
      ],
    },
    winter: {
      title: "Ensimmäinen talvimökkisi",
      lead: "Lunta, hiljaisuutta ja lämmin takkatuli. Muutama asia tekee talvilomasta helpomman.",
      sections: [
        {
          heading: "Perille pääseminen",
          body: "Varmista, että mökkitie on aurattu ja pääseekö autolla oven lähelle. Talvirenkaat ovat pakolliset talvella suurimmassa osassa aluetta, ja vuokra-autoissa ne on valmiina.",
        },
        {
          heading: "Pysy lämpimänä",
          body: "Moni mökki pidetään tyhjillään vain vähän pakkasen yläpuolella, joten lämpeneminen voi kestää muutaman tunnin. Kysy omistajalta, miten lämmitys ja takka toimivat ja missä polttopuut ovat.",
        },
        {
          heading: "Lyhyet päivät",
          body: "Joulukuussa aurinko on etelässä taivaalla vain muutaman tunnin ja kaukana pohjoisessa ei lainkaan. Suunnittele ulkoilu valoisan ajan mukaan, ota otsalamppu mukaan ja nauti lumen hehkusta.",
        },
      ],
    },
  },
};
