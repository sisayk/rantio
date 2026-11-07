import type { Country } from "@/lib/listings";

import type { Lang } from "../locales";

/** The short line under each row title on the app's Explore, as in Airbnb's app
 *  ("Stay in Vantaa — Finnish city outside Helsinki"). One line each, so keep them short.
 *  Regions get a line only when they have a row of their own (two cottages or more). */
export type RowsText = {
  regions: Record<string, string>;
  countries: Record<Country, string>;
  /** The last row, with the cottages that have no row of their own. */
  more: string;
};

export const ROWS: Record<Lang, RowsText> = {
  en: {
    regions: { uusimaa: "Lakes and sea around Helsinki" },
    countries: {
      FI: "Lakes, saunas and Lapland",
      SE: "Red stugor, forests and fells",
      NO: "Fjords and mountain cabins",
      DK: "Dune cottages by the sea",
      IS: "Fjords and hot springs",
      EE: "Islands and smoke saunas",
      LV: "Lakes and pine forests",
      LT: "Dunes and quiet lakes",
    },
    more: "From the North Atlantic to the Baltics",
  },
  fi: {
    regions: { uusimaa: "Järviä ja merta Helsingin lähellä" },
    countries: {
      FI: "Järviä, saunoja ja Lappi",
      SE: "Punaisia mökkejä, metsää ja tuntureita",
      NO: "Vuonoja ja vuoristomökkejä",
      DK: "Dyynimökkejä meren rannalla",
      IS: "Vuonoja ja kuumia lähteitä",
      EE: "Saaria ja savusaunoja",
      LV: "Järviä ja mäntymetsiä",
      LT: "Dyynejä ja tyyniä järviä",
    },
    more: "Pohjois-Atlantilta Baltiaan",
  },
  sv: {
    regions: { uusimaa: "Sjöar och hav runt Helsingfors" },
    countries: {
      FI: "Sjöar, bastur och Lappland",
      SE: "Röda stugor, skog och fjäll",
      NO: "Fjordar och fjällstugor",
      DK: "Klitstugor vid havet",
      IS: "Fjordar och varma källor",
      EE: "Öar och rökbastur",
      LV: "Sjöar och tallskogar",
      LT: "Dyner och stilla sjöar",
    },
    more: "Från Nordatlanten till Baltikum",
  },
  nb: {
    regions: { uusimaa: "Innsjøer og hav rundt Helsingfors" },
    countries: {
      FI: "Innsjøer, badstuer og Lappland",
      SE: "Røde hytter, skog og fjell",
      NO: "Fjorder og fjellhytter",
      DK: "Klitthus ved havet",
      IS: "Fjorder og varme kilder",
      EE: "Øyer og røykbadstuer",
      LV: "Innsjøer og furuskog",
      LT: "Sanddyner og stille innsjøer",
    },
    more: "Fra Nord-Atlanteren til Baltikum",
  },
  nn: {
    regions: { uusimaa: "Innsjøar og hav rundt Helsingfors" },
    countries: {
      FI: "Innsjøar, badstover og Lappland",
      SE: "Raude hytter, skog og fjell",
      NO: "Fjordar og fjellhytter",
      DK: "Klitthus ved havet",
      IS: "Fjordar og varme kjelder",
      EE: "Øyar og røykbadstover",
      LV: "Innsjøar og furuskog",
      LT: "Sanddyner og stille innsjøar",
    },
    more: "Frå Nord-Atlanteren til Baltikum",
  },
  da: {
    regions: { uusimaa: "Søer og hav omkring Helsinki" },
    countries: {
      FI: "Søer, saunaer og Lapland",
      SE: "Røde hytter, skov og fjelde",
      NO: "Fjorde og fjeldhytter",
      DK: "Klithuse ved havet",
      IS: "Fjorde og varme kilder",
      EE: "Øer og røgsaunaer",
      LV: "Søer og fyrreskove",
      LT: "Klitter og stille søer",
    },
    more: "Fra Nordatlanten til Baltikum",
  },
  is: {
    regions: { uusimaa: "Vötn og haf í kringum Helsinki" },
    countries: {
      FI: "Vötn, gufuböð og Lappland",
      SE: "Rauð sumarhús, skógar og fjöll",
      NO: "Firðir og fjallakofar",
      DK: "Sumarhús í sandöldum við hafið",
      IS: "Firðir og heitar laugar",
      EE: "Eyjar og reykgufuböð",
      LV: "Vötn og furuskógar",
      LT: "Sandöldur og kyrr vötn",
    },
    more: "Frá Norður-Atlantshafi til Eystrasaltslanda",
  },
  et: {
    regions: { uusimaa: "Järved ja meri Helsingi ümbruses" },
    countries: {
      FI: "Järved, saunad ja Lapimaa",
      SE: "Punased majad, metsad ja mäed",
      NO: "Fjordid ja mägionnid",
      DK: "Luitemajad mere ääres",
      IS: "Fjordid ja kuumaveeallikad",
      EE: "Saared ja suitsusaunad",
      LV: "Järved ja männimetsad",
      LT: "Luited ja vaiksed järved",
    },
    more: "Põhja-Atlandist Baltimaadeni",
  },
  lv: {
    regions: { uusimaa: "Ezeri un jūra ap Helsinkiem" },
    countries: {
      FI: "Ezeri, pirtis un Lapzeme",
      SE: "Sarkanas mājiņas, meži un kalni",
      NO: "Fjordi un kalnu mājiņas",
      DK: "Kāpu mājiņas pie jūras",
      IS: "Fjordi un karstie avoti",
      EE: "Salas un dūmu pirtis",
      LV: "Ezeri un priežu meži",
      LT: "Kāpas un mierīgi ezeri",
    },
    more: "No Ziemeļatlantijas līdz Baltijai",
  },
  lt: {
    regions: { uusimaa: "Ežerai ir jūra aplink Helsinkį" },
    countries: {
      FI: "Ežerai, pirtys ir Laplandija",
      SE: "Raudoni nameliai, miškai ir kalnai",
      NO: "Fiordai ir kalnų nameliai",
      DK: "Kopų nameliai prie jūros",
      IS: "Fiordai ir karštieji šaltiniai",
      EE: "Salos ir dūminės pirtys",
      LV: "Ežerai ir pušynai",
      LT: "Kopos ir ramūs ežerai",
    },
    more: "Nuo Šiaurės Atlanto iki Baltijos",
  },
  de: {
    regions: { uusimaa: "Seen und Meer rund um Helsinki" },
    countries: {
      FI: "Seen, Saunen und Lappland",
      SE: "Rote Hütten, Wälder und Fjell",
      NO: "Fjorde und Berghütten",
      DK: "Dünenhäuser am Meer",
      IS: "Fjorde und heiße Quellen",
      EE: "Inseln und Rauchsaunen",
      LV: "Seen und Kiefernwälder",
      LT: "Dünen und stille Seen",
    },
    more: "Vom Nordatlantik bis ins Baltikum",
  },
};
