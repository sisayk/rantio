// Experiences, Destinations and Inspiration pages (src/app/[lang]/experiences, …).
// Part of the English messages as `explore`; translations live next to this file.
import type { Plural } from "../../format";

const p = (forms: Plural) => forms;

export const explore = {
  cottagesLink: p({ one: "See {n} cottage", other: "See {n} cottages" }),
  seasons: {
    summer: "Summer",
    autumn: "Late summer and autumn",
    winter: "Winter",
    allYear: "All year",
  },

  experiences: {
    meta: {
      title: "Things to do at a Nordic cottage | Stugora",
      description: "Sauna, swimming, paddling, fishing, hiking, skiing and the northern lights: find a cottage for what you'd like to do.",
    },
    title: "Things to do at a Nordic cottage",
    lead: "Sauna by the lake, paddling in the long evening light, skiing and the northern lights. Pick what you'd like to do and see the cottages that suit it.",
    note: "Stugora doesn't sell activities. The owner can tell you what's close by, and local guides take bookings for things like husky rides and aurora tours.",
    items: {
      sauna: {
        title: "Sauna and a cool dip",
        body: "Heat up in the cottage's own sauna, then cool off in the lake or sea. In winter, some brave a hole in the ice.",
      },
      swim: {
        title: "Swimming from your own shore",
        body: "Many cottages sit right on the water, with a jetty or a sandy shore a few steps from the door.",
      },
      paddling: {
        title: "Canoeing and paddling",
        body: "Calm lakes and sheltered bays are made for a canoe. These cottages have one waiting for you.",
      },
      fishing: {
        title: "Fishing from a boat",
        body: "Row out in the evening or fish through the ice in winter. Simple rod fishing is free in many places; other fishing needs a licence.",
      },
      hiking: {
        title: "Forest walks and wild berries",
        body: "Trails start at the door. From July, pick blueberries, lingonberries and mushrooms under everyman's right.",
      },
      aurora: {
        title: "Northern lights",
        body: "From late August to early April, dark skies in Lapland, northern Norway and Iceland bring the best chances.",
      },
      skiing: {
        title: "Skiing, downhill and cross-country",
        body: "Stay close to the slopes, or set off on cross-country tracks that run past the cottage.",
      },
      dogs: {
        title: "Holidays with your dog",
        body: "Room to roam and owners who welcome four-legged guests. Check the cottage's own rules before you book.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Cottage destinations in the Nordics and the Baltics | Stugora",
      description: "Finland, Sweden, Norway, Denmark, Iceland, Estonia, Latvia and Lithuania: lakes, fjords, dunes and forests, and the cottages there.",
    },
    title: "Destinations",
    lead: "Eight countries around the Baltic Sea and the North Atlantic, each with its own kind of cottage.",
    regions: "Cottages in",
    allIn: "All cottages in {country}",
    countries: {
      FI: "Thousands of lakes, a sauna at almost every cottage, and Lapland's snow and northern lights.",
      SE: "Red wooden stugor in deep forest, a skerry-strewn coast and mountains in the north.",
      NO: "Fjords, fishing cabins on the shore and mountains that drop straight into the sea.",
      DK: "Dune cottages behind long sandy beaches, with the North Sea a short walk away.",
      IS: "Fjords, hot springs and wide open skies that are dark enough for the aurora in winter.",
      EE: "Quiet islands, juniper meadows and the smoke sauna, an old Estonian tradition.",
      LV: "The lake country of Latgale, pine forests and a long, sandy Baltic coast.",
      LT: "The dunes of the Curonian Spit, thatched homesteads and calm rural lakes.",
    },
  },

  inspiration: {
    meta: {
      title: "Inspiration for your cottage stay | Stugora",
      description: "Short guides to the sauna, the northern lights, everyman's right, Midsummer and winter at a Nordic cottage.",
    },
    title: "Inspiration",
    lead: "Short guides for your cottage stay, from the sauna to the northern lights.",
    read: "Read the guide",
    minutes: p({ one: "{n} min read", other: "{n} min read" }),
    back: "All guides",
    ctaTitle: "Find a cottage for it",
    more: "More guides",
  },

  guides: {
    sauna: {
      title: "How to sauna like a local",
      lead: "A cottage sauna is the heart of a Nordic evening, and it's simpler than it looks.",
      sections: [
        {
          heading: "Warm it up",
          body: "A wood-fired sauna takes about an hour to heat, an electric one 30 to 45 minutes. Around 70 to 80 °C is plenty. Bring water to drink and a small towel to sit on.",
        },
        {
          heading: "Heat, cool, repeat",
          body: "Throw a ladle of water on the hot stones for a wave of steam, which Finns call löyly. Stay as long as it feels good, then cool off in the lake, the sea or the shower, rest a while and go back in. Two or three rounds is usual.",
        },
        {
          heading: "Sauna manners",
          body: "Shower before you go in. Families often bathe naked, and swimwear is fine among friends. Never leave a wood stove alone while the fire is going, and ask the owner how they like the sauna left.",
        },
      ],
    },
    aurora: {
      title: "When and where to see the northern lights",
      lead: "Dark, clear skies matter more than luck. Here's how to give yourself the best chance.",
      sections: [
        {
          heading: "When to go",
          body: "The season runs from about late August to early April, when the nights are dark enough. The hours around midnight are often best, but the lights can appear at any time it's dark.",
        },
        {
          heading: "Where to stay",
          body: "The further north you are, the more often you'll see them. Finnish and Swedish Lapland, northern Norway and Iceland get them on many clear nights; in southern Finland and the Baltics they show only when activity is strong.",
        },
        {
          heading: "How to watch",
          body: "Get away from lights: an open lake shore or a fell top is ideal. Check the cloud forecast and an aurora forecast, dress warmly and give your eyes a quarter of an hour to adjust. A phone camera on night mode often sees more than you do.",
        },
      ],
    },
    everyman: {
      title: "Everyman's right: roaming, berries and campfires",
      lead: "In Finland, Sweden, Norway and Estonia, nature is open to everyone, as long as you follow a few simple rules.",
      sections: [
        {
          heading: "What you can do",
          body: "You can walk, ski and cycle in forests and fields, swim in lakes and the sea, and pick wild berries, mushrooms and flowers that aren't protected, even on land someone else owns.",
        },
        {
          heading: "What to keep in mind",
          body: "Keep a respectful distance from homes and gardens, don't disturb animals or nesting birds, don't harm living trees and take your rubbish with you.",
        },
        {
          heading: "Campfires and fishing",
          body: "A campfire on someone else's land usually needs the owner's permission, and fire bans apply in dry weather. Simple rod fishing is free in many places, but other fishing needs a licence. The rules differ between countries, so ask the cottage owner.",
        },
      ],
    },
    midsummer: {
      title: "Midsummer at the cottage",
      lead: "The longest days of the year are the North's favourite holiday, and many people spend them at a cottage.",
      sections: [
        {
          heading: "When it is",
          body: "In Finland and Sweden, Midsummer Eve is the Friday between 19 and 25 June. Norway and Denmark celebrate Sankthans on 23 June, and Estonia, Latvia and Lithuania have their own Midsummer festivals on 23 and 24 June.",
        },
        {
          heading: "How it's celebrated",
          body: "Bonfires by the water, the sauna, new potatoes and herring, flower wreaths and dancing, depending on the country. North of the Arctic Circle the sun doesn't set at all.",
        },
        {
          heading: "Plan ahead",
          body: "Midsummer is one of the busiest weeks for cottages, and many shops close or keep short hours over the holiday. Book early and buy your food before Midsummer Eve.",
        },
      ],
    },
    winter: {
      title: "Your first winter cottage",
      lead: "Snow, silence and a warm fire. A few things make a winter stay easier.",
      sections: [
        {
          heading: "Getting there",
          body: "Check that the road to the cottage is ploughed and whether you can park near the door. Winter tyres are required in most of the region in winter, and rental cars come with them.",
        },
        {
          heading: "Staying warm",
          body: "Many cottages are kept only just above freezing while empty, so the place can take a few hours to warm up. Ask the owner how the heating and fireplace work and where the firewood is.",
        },
        {
          heading: "Short days",
          body: "In December the sun is up for only a few hours in the south and not at all in the far north. Plan outdoor time around the light, bring a head torch and enjoy the glow of the snow.",
        },
      ],
    },
  },
};
