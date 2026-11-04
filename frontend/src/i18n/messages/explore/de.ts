import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "{n} Ferienhaus ansehen", other: "{n} Ferienhäuser ansehen" },
  seasons: {
    summer: "Sommer",
    autumn: "Spätsommer und Herbst",
    winter: "Winter",
    allYear: "Ganzjährig",
  },

  experiences: {
    meta: {
      title: "Erlebnisse rund ums nordische Ferienhaus | Rantio",
      description: "Sauna, Baden, Paddeln, Angeln, Wandern, Skifahren und Polarlichter: Finde ein Ferienhaus für das, was du erleben möchtest.",
    },
    title: "Erlebnisse rund ums Ferienhaus",
    lead: "Sauna am See, Paddeln im langen Abendlicht, Skifahren und Polarlichter. Wähle, was du erleben möchtest, und sieh dir die passenden Ferienhäuser an.",
    note: "Rantio verkauft keine Aktivitäten. Die Gastgeber wissen, was es in der Nähe gibt, und lokale Anbieter nehmen Buchungen für Huskytouren, Polarlichtausflüge und Ähnliches entgegen.",
    items: {
      sauna: {
        title: "Sauna und ein kühles Bad",
        body: "Heiz dich in der eigenen Sauna auf und kühl dich danach im See oder im Meer ab. Im Winter wagen sich manche sogar ins Eisloch.",
      },
      swim: {
        title: "Baden am eigenen Ufer",
        body: "Viele Ferienhäuser liegen direkt am Wasser, mit Steg oder Sandstrand nur ein paar Schritte von der Tür.",
      },
      paddling: {
        title: "Kanu fahren und paddeln",
        body: "Ruhige Seen und geschützte Buchten sind wie gemacht fürs Kanu. Bei diesen Ferienhäusern liegt schon eins für dich bereit.",
      },
      fishing: {
        title: "Angeln vom Boot",
        body: "Ruder abends hinaus oder angle im Winter durchs Eis. Einfaches Angeln mit der Rute ist vielerorts frei, für alles andere brauchst du einen Angelschein.",
      },
      hiking: {
        title: "Waldspaziergänge und wilde Beeren",
        body: "Die Wege beginnen direkt vor der Tür. Ab Juli darfst du dank Jedermannsrecht Heidelbeeren, Preiselbeeren und Pilze sammeln.",
      },
      aurora: {
        title: "Polarlichter",
        body: "Von Ende August bis Anfang April hast du unter dem dunklen Himmel in Lappland, Nordnorwegen und Island die besten Chancen.",
      },
      skiing: {
        title: "Ski alpin und Langlauf",
        body: "Wohn nah an der Piste oder starte auf Loipen, die direkt am Ferienhaus vorbeiführen.",
      },
      dogs: {
        title: "Urlaub mit Hund",
        body: "Viel Platz zum Toben und Gastgeber, die Vierbeiner gern willkommen heißen. Schau vor der Buchung in die Hausregeln.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Ferienhaus-Reiseziele im Norden und im Baltikum | Rantio",
      description: "Finnland, Schweden, Norwegen, Dänemark, Island, Estland, Lettland und Litauen: Seen, Fjorde, Dünen und Wälder und die Ferienhäuser dort.",
    },
    title: "Reiseziele",
    lead: "Acht Länder rund um die Ostsee und den Nordatlantik, jedes mit seiner eigenen Art von Ferienhaus.",
    regions: "Ferienhäuser in",
    allIn: "Alle Ferienhäuser in {country}",
    countries: {
      FI: "Tausende Seen, eine Sauna bei fast jedem Ferienhaus und Schnee und Polarlichter in Lappland.",
      SE: "Rote Holzhäuser tief im Wald, eine Küste voller Schären und Berge im Norden.",
      NO: "Fjorde, Fischerhütten am Ufer und Berge, die direkt ins Meer abfallen.",
      DK: "Ferienhäuser in den Dünen hinter langen Sandstränden, die Nordsee nur ein paar Schritte entfernt.",
      IS: "Fjorde, heiße Quellen und ein weiter Himmel, der im Winter dunkel genug für Polarlichter ist.",
      EE: "Ruhige Inseln, Wacholderwiesen und die Rauchsauna, eine alte estnische Tradition.",
      LV: "Die Seenlandschaft Lettgallens, Kiefernwälder und eine lange, sandige Ostseeküste.",
      LT: "Die Dünen der Kurischen Nehrung, reetgedeckte Höfe und stille Seen auf dem Land.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiration für deinen Ferienhausurlaub | Rantio",
      description: "Kurze Ratgeber zu Sauna, Polarlichtern, Jedermannsrecht, Mittsommer und Winter im nordischen Ferienhaus.",
    },
    title: "Inspiration",
    lead: "Kurze Ratgeber für deinen Ferienhausurlaub, von der Sauna bis zu den Polarlichtern.",
    read: "Zum Ratgeber",
    minutes: { one: "{n} Min. Lesezeit", other: "{n} Min. Lesezeit" },
    back: "Alle Ratgeber",
    ctaTitle: "Das passende Ferienhaus finden",
    more: "Weitere Ratgeber",
  },

  guides: {
    sauna: {
      title: "Saunieren wie die Einheimischen",
      lead: "Die Sauna ist das Herz eines nordischen Abends im Ferienhaus, und sie ist einfacher, als sie aussieht.",
      sections: [
        {
          heading: "Aufheizen",
          body: "Eine Holzsauna braucht etwa eine Stunde zum Aufheizen, eine elektrische 30 bis 45 Minuten. 70 bis 80 °C reichen völlig. Nimm etwas zu trinken mit und ein kleines Handtuch zum Draufsitzen.",
        },
        {
          heading: "Schwitzen, abkühlen, wiederholen",
          body: "Gieß eine Kelle Wasser auf die heißen Steine, dann steigt eine Welle Dampf auf, die die Finnen Löyly nennen. Bleib, solange es dir guttut, kühl dich dann im See, im Meer oder unter der Dusche ab, ruh dich kurz aus und geh wieder hinein. Zwei oder drei Runden sind üblich.",
        },
        {
          heading: "Sauna-Knigge",
          body: "Dusch dich, bevor du hineingehst. Familien saunieren oft nackt, unter Freunden ist Badekleidung völlig in Ordnung. Lass einen Holzofen nie unbeaufsichtigt, solange das Feuer brennt, und frag die Gastgeber, wie sie die Sauna hinterlassen haben möchten.",
        },
      ],
    },
    aurora: {
      title: "Wann und wo du Polarlichter siehst",
      lead: "Ein dunkler, klarer Himmel zählt mehr als Glück. So hast du die besten Chancen.",
      sections: [
        {
          heading: "Die beste Reisezeit",
          body: "Die Saison reicht etwa von Ende August bis Anfang April, wenn die Nächte dunkel genug sind. Die Stunden um Mitternacht sind oft am besten, aber die Lichter können jederzeit erscheinen, sobald es dunkel ist.",
        },
        {
          heading: "Wo du wohnen solltest",
          body: "Je weiter nördlich du bist, desto öfter siehst du sie. Im finnischen und schwedischen Lappland, in Nordnorwegen und auf Island zeigen sie sich in vielen klaren Nächten; in Südfinnland und im Baltikum nur bei starker Aktivität.",
        },
        {
          heading: "So klappt's",
          body: "Weg vom Licht: Ein offenes Seeufer oder ein Fjellgipfel ist ideal. Prüf die Wolkenvorhersage und eine Polarlichtvorhersage, zieh dich warm an und gib deinen Augen eine Viertelstunde, um sich an die Dunkelheit zu gewöhnen. Eine Handykamera im Nachtmodus sieht oft mehr als du.",
        },
      ],
    },
    everyman: {
      title: "Jedermannsrecht: wandern, Beeren sammeln, Lagerfeuer",
      lead: "In Finnland, Schweden, Norwegen und Estland steht die Natur allen offen, solange du ein paar einfache Regeln beachtest.",
      sections: [
        {
          heading: "Was du darfst",
          body: "Du darfst in Wald und Flur wandern, Ski fahren und Rad fahren, in Seen und im Meer baden und wilde Beeren, Pilze und nicht geschützte Blumen pflücken, auch auf fremdem Grund.",
        },
        {
          heading: "Was du beachten solltest",
          body: "Halt respektvoll Abstand zu Häusern und Gärten, stör keine Tiere und brütenden Vögel, beschädige keine lebenden Bäume und nimm deinen Müll wieder mit.",
        },
        {
          heading: "Lagerfeuer und Angeln",
          body: "Für ein Lagerfeuer auf fremdem Grund brauchst du meist die Erlaubnis des Eigentümers, und bei Trockenheit gilt Feuerverbot. Einfaches Angeln mit der Rute ist vielerorts frei, für alles andere brauchst du einen Angelschein. Die Regeln sind von Land zu Land verschieden, also frag am besten die Gastgeber.",
        },
      ],
    },
    midsummer: {
      title: "Mittsommer im Ferienhaus",
      lead: "Die längsten Tage des Jahres sind das liebste Fest im Norden, und viele verbringen sie im Ferienhaus.",
      sections: [
        {
          heading: "Wann gefeiert wird",
          body: "In Finnland und Schweden ist der Mittsommerabend der Freitag zwischen dem 19. und 25. Juni. In Norwegen und Dänemark feiert man Sankthans am 23. Juni, und Estland, Lettland und Litauen haben am 23. und 24. Juni ihre eigenen Mittsommerfeste.",
        },
        {
          heading: "Wie gefeiert wird",
          body: "Je nach Land mit Feuern am Wasser, Sauna, neuen Kartoffeln und Hering, Blumenkränzen und Tanz. Nördlich des Polarkreises geht die Sonne gar nicht unter.",
        },
        {
          heading: "Früh planen",
          body: "Mittsommer ist eine der gefragtesten Wochen für Ferienhäuser, und viele Geschäfte schließen über die Feiertage oder haben nur kurz geöffnet. Buch früh und kauf deine Lebensmittel vor dem Mittsommerabend ein.",
        },
      ],
    },
    winter: {
      title: "Dein erstes Ferienhaus im Winter",
      lead: "Schnee, Stille und ein warmes Feuer. Mit ein paar Tipps wird dein Winteraufenthalt noch entspannter.",
      sections: [
        {
          heading: "Die Anreise",
          body: "Prüf, ob die Zufahrt zum Ferienhaus geräumt ist und ob du nah an der Tür parken kannst. Winterreifen sind im Winter in fast der ganzen Region Pflicht, Mietwagen sind damit ausgestattet.",
        },
        {
          heading: "Warm bleiben",
          body: "Viele Ferienhäuser werden bei Leerstand nur knapp über dem Gefrierpunkt gehalten, deshalb kann es ein paar Stunden dauern, bis es warm wird. Frag die Gastgeber, wie Heizung und Kamin funktionieren und wo das Brennholz liegt.",
        },
        {
          heading: "Kurze Tage",
          body: "Im Dezember scheint die Sonne im Süden nur ein paar Stunden und ganz im Norden gar nicht. Plan die Zeit draußen nach dem Tageslicht, nimm eine Stirnlampe mit und genieß das Leuchten des Schnees.",
        },
      ],
    },
  },
};
