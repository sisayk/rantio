// Names people use for the same place in different languages, so a search for
// "Helsingfors", "Åbo", "Tallinna" or "København" finds the right cottages.
import { COUNTRY_LANGS, type Lang, LANGS } from "@/i18n/locales";
import { countryName } from "@/i18n/format";
import type { Region } from "./places";

/** Other names for towns, keyed by the name used in places.ts. */
export const CITY_ALIASES: Record<string, string[]> = {
  Helsinki: ["Helsingfors", "Helsingi"],
  Espoo: ["Esbo"],
  Vantaa: ["Vanda"],
  Turku: ["Åbo", "Turu"],
  Tampere: ["Tammerfors"],
  Porvoo: ["Borgå"],
  Lohja: ["Lojo"],
  Sipoo: ["Sibbo"],
  Kirkkonummi: ["Kyrkslätt"],
  Vaasa: ["Vasa"],
  Oulu: ["Uleåborg"],
  Kokkola: ["Karleby"],
  Pietarsaari: ["Jakobstad"],
  Hämeenlinna: ["Tavastehus"],
  Lappeenranta: ["Villmanstrand"],
  Savonlinna: ["Nyslott"],
  Mariehamn: ["Maarianhamina"],
  Rovaniemi: ["Roavvenjárga"],
  Inari: ["Anár", "Enare"],
  Stockholm: ["Tukholma", "Stokholm", "Stokholma", "Stokholmas"],
  Gothenburg: ["Göteborg", "Gautaborg", "Göteborgi"],
  Malmö: ["Malmo"],
  Uppsala: ["Upsala"],
  Copenhagen: ["København", "Köpenhamn", "Kööpenhamina", "Kaupmannahöfn", "Kopenhaagen", "Kopenhāgena", "Kopenhaga"],
  Aarhus: ["Århus"],
  Oslo: ["Kristiania"],
  Tromsø: ["Tromso", "Tromssa", "Romsa"],
  Trondheim: ["Nidaros"],
  "Reykjavík": ["Reykjavik"],
  Tallinn: ["Tallinna", "Reval"],
  Tartu: ["Tarto", "Dorpat"],
  Pärnu: ["Pernau", "Parnu"],
  Kuressaare: ["Arensburg"],
  Riga: ["Rīga", "Riika", "Ryga"],
  Jūrmala: ["Jurmala"],
  Liepāja: ["Liepaja", "Libau"],
  Vilnius: ["Vilna", "Vilno", "Viļņa"],
  Kaunas: ["Kowno", "Kauņa"],
  Klaipėda: ["Klaipeda", "Memel"],
  Nida: ["Nidden"],
};

/** Every name a town goes by: its own plus the aliases above. */
export const cityNames = (name: string) => [name, ...(CITY_ALIASES[name] ?? [])];

/** A country's name in all of our languages, for matching searches typed in any of them. */
export const countryNamesAll = (code: string) => LANGS.map((lang) => countryName(lang, code));

/** A region's name for the page: Finnish names on Finnish pages, the local name
 *  where the page's language is spoken there, otherwise the English name. */
export function regionLabel(region: Pick<Region, "name">, country: string, lang: Lang): string {
  if (lang === "fi") return region.name.fi;
  if (country !== "FI" && COUNTRY_LANGS[country]?.includes(lang)) return region.name.local;
  return region.name.en;
}
