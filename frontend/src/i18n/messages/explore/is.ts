import type { Translation } from "../../translation";

export const explore: NonNullable<Translation["explore"]> = {
  cottagesLink: { one: "Sjá {n} bústað", other: "Sjá {n} bústaði" },
  seasons: {
    summer: "Sumar",
    autumn: "Síðsumar og haust",
    winter: "Vetur",
    allYear: "Allt árið",
  },

  experiences: {
    meta: {
      title: "Afþreying í norrænum bústað | Rantio",
      description: "Gufubað, sund, kajakróður, veiði, gönguferðir, skíði og norðurljós: finndu bústað fyrir það sem þig langar að gera.",
    },
    title: "Afþreying í bústaðnum",
    lead: "Gufubað við vatnið, róður í löngu kvöldbirtunni, skíði og norðurljós. Veldu hvað þig langar að gera og skoðaðu bústaðina sem henta.",
    note: "Rantio selur ekki afþreyingu. Eigandinn getur sagt þér hvað er í nágrenninu og leiðsögumenn á staðnum taka við bókunum, til dæmis í hundasleðaferðir og norðurljósaferðir.",
    items: {
      sauna: {
        title: "Gufubað og svalandi sundsprettur",
        body: "Hitaðu þig upp í gufubaði bústaðarins og kældu þig svo í vatninu eða sjónum. Á veturna fara þeir hugrökkustu ofan í vök.",
      },
      swim: {
        title: "Sund frá eigin strönd",
        body: "Margir bústaðir standa alveg við vatnið, með bryggju eða sandströnd nokkrum skrefum frá dyrunum.",
      },
      paddling: {
        title: "Kanó og kajak",
        body: "Kyrr vötn og skjólgóðar víkur eru eins og sköpuð fyrir kanó. Við þessa bústaði bíður einn eftir þér.",
      },
      fishing: {
        title: "Veiði af bát",
        body: "Róðu út að kvöldi eða veiddu gegnum ísinn á veturna. Einföld stangveiði er víða ókeypis en önnur veiði krefst veiðileyfis.",
      },
      hiking: {
        title: "Skógargöngur og villt ber",
        body: "Göngustígarnir byrja við dyrnar. Frá júlí getur þú tínt bláber, týtuber og sveppi samkvæmt almannarétti.",
      },
      aurora: {
        title: "Norðurljós",
        body: "Frá lokum ágúst fram í byrjun apríl gefur dimmur himinn í Lapplandi, Norður-Noregi og á Íslandi bestu möguleikana.",
      },
      skiing: {
        title: "Svig og gönguskíði",
        body: "Gistu nálægt brekkunum eða leggðu af stað eftir gönguskíðabrautum sem liggja fram hjá bústaðnum.",
      },
      dogs: {
        title: "Frí með hundinum",
        body: "Nóg pláss til að hlaupa um og eigendur sem bjóða ferfætta gesti velkomna. Kynntu þér reglur bústaðarins áður en þú bókar.",
      },
    },
  },

  destinations: {
    meta: {
      title: "Áfangastaðir með bústöðum á Norðurlöndum og í Eystrasaltslöndum | Rantio",
      description: "Finnland, Svíþjóð, Noregur, Danmörk, Ísland, Eistland, Lettland og Litháen: vötn, firðir, sandöldur og skógar, og bústaðirnir þar.",
    },
    title: "Áfangastaðir",
    lead: "Átta lönd við Eystrasalt og Norður-Atlantshaf, hvert með sína eigin gerð af bústað.",
    regions: "Bústaðir á svæðunum",
    allIn: "Allir bústaðir: {country}",
    countries: {
      FI: "Þúsundir vatna, gufubað við nánast hvern bústað og snjór og norðurljós í Lapplandi.",
      SE: "Rauð timburhús djúpt inni í skóginum, skerjótt strönd og fjöll í norðri.",
      NO: "Firðir, fiskimannakofar við sjóinn og fjöll sem steypast beint í hafið.",
      DK: "Bústaðir í sandöldunum á bak við langar sandstrendur, með Norðursjóinn skammt undan.",
      IS: "Firðir, heitar laugar og víður himinn sem er nógu dimmur fyrir norðurljós á veturna.",
      EE: "Kyrrlátar eyjar, einiberjaengi og reykgufubaðið, gömul eistnesk hefð.",
      LV: "Vatnasvæðið í Latgale, furuskógar og löng sandströnd við Eystrasalt.",
      LT: "Sandöldurnar á Kúrlandsgranda, sveitabæir með stráþökum og kyrr vötn í sveitinni.",
    },
  },

  inspiration: {
    meta: {
      title: "Innblástur fyrir bústaðaferðina | Rantio",
      description: "Stuttar leiðbeiningar um gufubað, norðurljós, almannarétt, Jónsmessu og vetur í norrænum bústað.",
    },
    title: "Innblástur",
    lead: "Stuttar leiðbeiningar fyrir bústaðaferðina, frá gufubaðinu til norðurljósanna.",
    read: "Lesa nánar",
    minutes: { one: "{n} mín. lestur", other: "{n} mín. lestur" },
    back: "Allar leiðbeiningar",
    ctaTitle: "Finndu bústað fyrir það",
    more: "Fleiri leiðbeiningar",
  },

  guides: {
    sauna: {
      title: "Svona ferðu í gufubað eins og heimamenn",
      lead: "Gufubað bústaðarins er hjarta norræns kvölds og það er einfaldara en það lítur út fyrir.",
      sections: [
        {
          heading: "Hitaðu það upp",
          body: "Viðarkynt gufubað þarf um klukkustund til að hitna, rafmagnsgufubað 30 til 45 mínútur. Um 70 til 80 °C er alveg nóg. Taktu með þér eitthvað að drekka og lítið handklæði til að sitja á.",
        },
        {
          heading: "Hiti, kæling og aftur",
          body: "Helltu ausu af vatni á heitu steinana og fáðu gufubylgju, sem Finnar kalla löyly. Vertu inni eins lengi og þér líður vel, kældu þig svo í vatninu, sjónum eða sturtunni, hvíldu þig og farðu aftur inn. Tvær eða þrjár umferðir eru algengar.",
        },
        {
          heading: "Siðir í gufubaðinu",
          body: "Farðu í sturtu áður en þú ferð inn. Fjölskyldur eru oft naktar og sundföt eru í góðu lagi meðal vina. Skildu viðarofn aldrei eftir eftirlitslausan meðan eldur logar og spurðu eigandann hvernig hann vill að gengið sé frá gufubaðinu.",
        },
      ],
    },
    aurora: {
      title: "Hvenær og hvar þú sérð norðurljósin",
      lead: "Dimmur og heiður himinn skiptir meira máli en heppni. Svona gefur þú þér bestu möguleikana.",
      sections: [
        {
          heading: "Hvenær á að fara",
          body: "Tímabilið stendur frá því um lok ágúst fram í byrjun apríl, þegar næturnar eru nógu dimmar. Tímarnir í kringum miðnætti eru oft bestir en ljósin geta birst hvenær sem dimmt er.",
        },
        {
          heading: "Hvar á að gista",
          body: "Því norðar sem þú ert, því oftar sérðu þau. Í finnska og sænska Lapplandi, Norður-Noregi og á Íslandi sjást þau margar heiðskírar nætur; í Suður-Finnlandi og Eystrasaltslöndunum aðeins þegar virknin er mikil.",
        },
        {
          heading: "Svona horfir þú",
          body: "Komdu þér burt frá ljósum: opin vatnsströnd eða fjallstoppur er tilvalinn. Skoðaðu skýjaspá og norðurljósaspá, klæddu þig vel og gefðu augunum stundarfjórðung til að venjast myrkrinu. Símamyndavél í næturstillingu sér oft meira en þú.",
        },
      ],
    },
    everyman: {
      title: "Almannaréttur: útivist, ber og varðeldar",
      lead: "Í Finnlandi, Svíþjóð, Noregi og Eistlandi er náttúran opin öllum, svo lengi sem þú fylgir nokkrum einföldum reglum.",
      sections: [
        {
          heading: "Þetta máttu gera",
          body: "Þú mátt ganga, fara á skíði og hjóla í skógum og á ökrum, synda í vötnum og sjó og tína villt ber, sveppi og blóm sem eru ekki friðuð, líka á landi sem aðrir eiga.",
        },
        {
          heading: "Hafðu þetta í huga",
          body: "Haltu virðingarfjarlægð frá húsum og görðum, truflaðu ekki dýr eða varpfugla, skemmdu ekki lifandi tré og taktu ruslið með þér.",
        },
        {
          heading: "Varðeldar og veiði",
          body: "Varðeldur á landi annarra krefst yfirleitt leyfis landeiganda og í þurrki gilda brennubönn. Einföld stangveiði er víða ókeypis en önnur veiði krefst veiðileyfis. Reglurnar eru mismunandi eftir löndum, svo spurðu eiganda bústaðarins.",
        },
      ],
    },
    midsummer: {
      title: "Jónsmessa í bústaðnum",
      lead: "Lengstu dagar ársins eru eftirlætishátíð Norðurlanda og margir eyða þeim í bústað.",
      sections: [
        {
          heading: "Hvenær hún er",
          body: "Í Finnlandi og Svíþjóð er Jónsmessuaftann föstudagurinn á milli 19. og 25. júní. Í Noregi og Danmörku er Sankthans haldinn 23. júní og Eistland, Lettland og Litháen halda sínar eigin miðsumarhátíðir 23. og 24. júní.",
        },
        {
          heading: "Svona er haldið upp á hana",
          body: "Brennur við vatnið, gufubað, nýjar kartöflur og síld, blómakransar og dans, eftir löndum. Norðan heimskautsbaugs sest sólin alls ekki.",
        },
        {
          heading: "Skipuleggðu tímanlega",
          body: "Miðsumar er ein annasamasta vika ársins í bústöðunum og margar verslanir loka eða stytta opnunartímann yfir hátíðina. Bókaðu snemma og keyptu inn fyrir hátíðarkvöldið.",
        },
      ],
    },
    winter: {
      title: "Fyrsti vetrarbústaðurinn þinn",
      lead: "Snjór, kyrrð og hlýr arineldur. Nokkur atriði gera vetrardvölina auðveldari.",
      sections: [
        {
          heading: "Að komast á staðinn",
          body: "Gakktu úr skugga um að vegurinn að bústaðnum sé ruddur og hvort þú getir lagt nálægt dyrunum. Vetrardekk eru skylda að vetri til víðast hvar á svæðinu og bílaleigubílar eru á þeim.",
        },
        {
          heading: "Að halda á sér hita",
          body: "Margir bústaðir eru aðeins hafðir rétt yfir frostmarki þegar þeir standa auðir, svo það getur tekið nokkrar klukkustundir að hlýna. Spurðu eigandann hvernig hitinn og arinninn virka og hvar eldiviðurinn er.",
        },
        {
          heading: "Stuttir dagar",
          body: "Í desember er sólin aðeins á lofti í nokkrar klukkustundir í suðri og alls ekki nyrst. Skipuleggðu útiveruna eftir birtunni, taktu ennisljós með og njóttu bjarmans af snjónum.",
        },
      ],
    },
  },
};
