/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: what the site knows
  ------------------------------------
  Neighbourhoods, the problems people can report, the Runaki tariff, a few
  news stories and useful links. Nothing here changes while the page is
  open; live reports, planned cuts and team news come from the server
  (see store.js).

  The server reads this same file (server/lib/places.js), so the list of
  neighbourhoods and problems only lives in one place. Keep it free of
  anything that needs a browser.
*/

(function (root) {
  "use strict";

  /* Cities -----------------------------------------------------------------
     Erbil is split into neighbourhoods. The other places with Runaki are
     one area each for now: the ten named, with Erbil, in the Ministry of
     Electricity's figures of 23 April 2026 (gov.krd/moel-en). `gov` is the
     governorate whose private-generator committee sets prices and hours.  */
  const CITIES = [
    { slug: "erbil", gov: "erbil", name: { en: "Erbil", ckb: "هەولێر", kmr: "Hewlêr", ar: "أربيل" } },
    { slug: "slemani", gov: "slemani", name: { en: "Slemani", ckb: "سلێمانی", kmr: "Silêmanî", ar: "السليمانية" } },
    { slug: "duhok", gov: "duhok", name: { en: "Duhok", ckb: "دهۆک", kmr: "Dihok", ar: "دهوك" } },
    { slug: "halabja", gov: "halabja", name: { en: "Halabja", ckb: "هەڵەبجە", kmr: "Helebce", ar: "حلبجة" } },
    { slug: "soran", gov: "erbil", name: { en: "Soran", ckb: "سۆران", kmr: "Soran", ar: "سوران" } },
    { slug: "zakho", gov: "duhok", name: { en: "Zakho", ckb: "زاخۆ", kmr: "Zaxo", ar: "زاخو" } },
    {
      slug: "ranya",
      gov: "slemani",
      name: { en: "Raparin (Rania)", ckb: "ڕاپەڕین (ڕانیە)", kmr: "Raperîn (Ranye)", ar: "رابرين (رانية)" },
    },
    { slug: "koya", gov: "erbil", name: { en: "Koya", ckb: "کۆیە", kmr: "Koye", ar: "كويه (كويسنجق)" } },
    { slug: "pirmam", gov: "erbil", name: { en: "Pirmam", ckb: "پیرمام", kmr: "Pîrmam", ar: "بيرمام" } },
    { slug: "akre", gov: "duhok", name: { en: "Akre", ckb: "ئاکرێ", kmr: "Akrê", ar: "عقرة" } },
    { slug: "simel", gov: "duhok", name: { en: "Simel", ckb: "سێمێل", kmr: "Sêmêl", ar: "سميل" } },
  ];

  /* Neighbourhoods ---------------------------------------------------------
     name: how the neighbourhood is written in each language
     alt:  other spellings people actually type (used by search + assistant)
     runaki: covered | switching | notyet | unknown
     water:  network | tanker | mixed | unknown
     city:   which city it's in (from CITIES); Erbil when it isn't given
     lat/lng: the neighbourhood's point on OpenStreetMap (checked October 2026).
     Kasnazan, Baharka and Kani Qirzhala are separate towns/villages on the
     edge of the city, so their points are well outside the ring roads.     */
  const AREAS = [
    {
      slug: "ankawa",
      lat: 36.2284,
      lng: 43.9953,
      runaki: "covered",
      since: "2025-06",
      water: "network",
      name: { en: "Ankawa", ckb: "عەنکاوە", kmr: "Enkawa", ar: "عنكاوا" },
      alt: ["ainkawa", "ankawa", "enkawa", "einkawa", "ئەنکاوە", "ئەنکاوا", "عەینکاوە", "عينكاوة", "عنكاوة", "عينكاوا"],
    },
    {
      slug: "city-centre",
      lat: 36.1905,
      lng: 44.0095,
      runaki: "unknown",
      water: "network",
      name: { en: "City Centre", ckb: "ناوەندی شار", kmr: "Navenda bajêr", ar: "مركز المدينة" },
      alt: [
        "city centre",
        "city center",
        "downtown",
        "citadel",
        "qalat",
        "bazar",
        "navenda bajer",
        "ناوەندی شار",
        "قەڵا",
        "بازاڕ",
        "قلعة",
        "وسط المدينة",
        "مركز المدينة",
        "السوق",
      ],
    },
    {
      slug: "iskan",
      lat: 36.1756,
      lng: 44.0243,
      runaki: "switching",
      water: "network",
      name: { en: "Iskan", ckb: "ئیسکان", kmr: "Îskan", ar: "اسكان" },
      alt: ["eskan", "iskan", "إسكان", "الاسكان"],
    },
    {
      slug: "nishtiman",
      lat: 36.1793,
      lng: 43.9857,
      runaki: "switching",
      water: "mixed",
      name: { en: "Nishtiman", ckb: "نیشتمان", kmr: "Niştiman", ar: "نشتمان" },
      alt: ["nishtman", "nishtiman", "nistiman", "نیشتیمان"],
    },
    {
      slug: "mantik",
      lat: 36.1616,
      lng: 44.0202,
      runaki: "switching",
      water: "network",
      name: { en: "Mantik", ckb: "مانتیک", kmr: "Mantik", ar: "مانتيك" },
      alt: ["mantiq", "mantik", "منتك"],
    },
    {
      slug: "brayati",
      lat: 36.1978,
      lng: 44.0345,
      runaki: "switching",
      since: "2026-06",
      water: "network",
      name: { en: "Brayati", ckb: "برایەتی", kmr: "Birayetî", ar: "برايتي" },
      alt: ["brayati", "birayeti", "brayeti", "براياتي", "برايه تي"],
    },
    {
      slug: "bakhtiari",
      lat: 36.2059,
      lng: 43.9947,
      runaki: "switching",
      water: "network",
      name: { en: "Bakhtiari", ckb: "بەختیاری", kmr: "Bextiyarî", ar: "بختياري" },
      alt: ["bakhtiyari", "bakhtiari", "bextiyari", "bextiari"],
    },
    {
      slug: "zanko",
      lat: 36.1543,
      lng: 44.033,
      runaki: "unknown",
      water: "mixed",
      name: { en: "Zanko", ckb: "زانکۆ", kmr: "Zanko", ar: "زانكو" },
      alt: ["zanko", "zankoy", "university", "زانکۆی", "الجامعة"],
    },
    {
      slug: "shorsh",
      lat: 36.206,
      lng: 44.02,
      runaki: "switching",
      water: "network",
      name: { en: "Shorsh", ckb: "شۆڕش", kmr: "Şoreş", ar: "شورش" },
      alt: ["shorsh", "shoresh", "soresh", "shoras"],
    },
    {
      slug: "kasnazan",
      lat: 36.202,
      lng: 44.136,
      runaki: "notyet",
      water: "tanker",
      name: { en: "Kasnazan", ckb: "کەسنەزان", kmr: "Kesnezan", ar: "كسنزان" },
      alt: ["kasnazan", "kesnezan", "kasnezan", "كسنه زان"],
    },
    {
      slug: "baharka",
      lat: 36.3156,
      lng: 44.0353,
      runaki: "notyet",
      water: "tanker",
      name: { en: "Baharka", ckb: "بەحرکە", kmr: "Behirke", ar: "بحركة" },
      alt: ["baharka", "bahrka", "behirke", "bahirka", "بەحەرکە", "بحركه"],
    },
    {
      slug: "turaq",
      lat: 36.1673,
      lng: 43.9369,
      runaki: "covered",
      since: "2025-09",
      water: "network",
      name: { en: "Turaq", ckb: "توراق", kmr: "Turaq", ar: "طوراق" },
      alt: ["turaq", "toraq", "turak", "توراق"],
    },
    {
      slug: "gulan",
      lat: 36.1994,
      lng: 44.0463,
      runaki: "covered",
      since: "2026-01",
      water: "network",
      name: { en: "Gulan", ckb: "گوڵان", kmr: "Gulan", ar: "كولان" },
      alt: ["gulan", "golan", "گولان", "كولان", "جولان"],
    },
    {
      slug: "waziran",
      lat: 36.2011,
      lng: 43.9887,
      runaki: "unknown",
      water: "unknown",
      name: { en: "Waziran", ckb: "وەزیران", kmr: "Wezîran", ar: "وزيران" },
      alt: ["waziran", "weziran", "wazeeran"],
    },
    {
      slug: "raparin",
      lat: 36.2098,
      lng: 44.0395,
      runaki: "unknown",
      water: "mixed",
      name: { en: "Raparin", ckb: "ڕاپەڕین", kmr: "Raperîn", ar: "رابرين" },
      alt: ["raparin", "raperin", "rapareen", "راپەرین", "رابه رين"],
    },
    {
      slug: "shanadar",
      lat: 36.182,
      lng: 44.0018,
      runaki: "covered",
      since: "2026-03",
      water: "network",
      name: { en: "Shanadar", ckb: "شانەدەر", kmr: "Şanedar", ar: "شاندر" },
      alt: ["shanadar", "shanader", "sanedar", "shanidar", "شانه دەر", "شانيدار"],
    },
    {
      slug: "kani-qirzhala",
      lat: 36.2065,
      lng: 43.8736,
      runaki: "notyet",
      water: "unknown",
      name: { en: "Kani Qirzhala", ckb: "کانی قرژاڵە", kmr: "Kanî Qirjale", ar: "كاني قرزالة" },
      alt: ["kani qirzhala", "kaniqirzhala", "kani qrzhala", "kani qirjale", "qirzhala", "قرژاڵە", "قرزالة"],
    },
    {
      slug: "mamostayan",
      lat: 36.1816,
      lng: 44.0287,
      runaki: "unknown",
      water: "network",
      name: { en: "Mamostayan", ckb: "مامۆستایان", kmr: "Mamostayan", ar: "المعلمين" },
      alt: ["mamostayan", "mamosta", "teachers", "مامۆستا", "معلمين"],
    },
    {
      slug: "farmanbaran",
      lat: 36.1491,
      lng: 44.062,
      runaki: "unknown",
      water: "unknown",
      name: { en: "Farmanbaran", ckb: "فەرمانبەران", kmr: "Fermanberan", ar: "الموظفين" },
      alt: ["farmanbaran", "farmanberan", "fermanberan", "farman baran", "فەرمانبەران", "فرمانبران", "حي الموظفين"],
    },
    /* A gated housing project on 100m Street by the airport (baghyshaqlawa.net).
       Compounds like it run their own generators for the houses inside. The
       point is the middle of the project, not checked on OpenStreetMap.   */
    {
      slug: "pavilion",
      lat: 36.2215,
      lng: 43.9745,
      kind: "compound",
      runaki: "unknown",
      water: "unknown",
      name: { en: "Pavilion", ckb: "پاڤیلیۆن", kmr: "Pavîlyon", ar: "بافيليون" },
      alt: ["pavilion", "pavilon", "pavillion", "paviliun", "پاڤیلیۆن", "پافیلیون", "بافيليون"],
    },

    /* The other Runaki cities, one area each. Their points are the city
       centres. Runaki reached the city centres first; villages around them
       may still be on generators, so the area page says so.              */
    {
      slug: "slemani",
      city: "slemani",
      kind: "city",
      lat: 35.5613,
      lng: 45.4302,
      runaki: "covered",
      water: "unknown",
      name: { en: "Slemani", ckb: "سلێمانی", kmr: "Silêmanî", ar: "السليمانية" },
      alt: [
        "slemani",
        "sulaimani",
        "sulaymaniyah",
        "sulaimaniya",
        "suli",
        "silemani",
        "silêmanî",
        "سلێمانی",
        "السليمانيه",
        "سليمانية",
      ],
    },
    {
      slug: "duhok",
      city: "duhok",
      kind: "city",
      lat: 36.8667,
      lng: 42.95,
      runaki: "covered",
      water: "unknown",
      name: { en: "Duhok", ckb: "دهۆک", kmr: "Dihok", ar: "دهوك" },
      alt: ["duhok", "dohuk", "dahuk", "dihok", "dhok", "دهۆک", "دهوك", "دهۆك"],
    },
    {
      slug: "halabja",
      city: "halabja",
      kind: "city",
      lat: 35.1778,
      lng: 45.9861,
      runaki: "covered",
      water: "unknown",
      name: { en: "Halabja", ckb: "هەڵەبجە", kmr: "Helebce", ar: "حلبجة" },
      alt: ["halabja", "halabjah", "helebce", "halabcha", "هەڵەبجە", "حلبجه"],
    },
    {
      slug: "soran",
      city: "soran",
      kind: "city",
      lat: 36.6528,
      lng: 44.5442,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Soran", ckb: "سۆران", kmr: "Soran", ar: "سوران" },
      alt: ["soran", "diana", "diyana", "سۆران", "دیانا", "ديانا"],
    },
    {
      slug: "zakho",
      city: "zakho",
      kind: "city",
      lat: 37.1436,
      lng: 42.6819,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Zakho", ckb: "زاخۆ", kmr: "Zaxo", ar: "زاخو" },
      alt: ["zakho", "zaxo", "zakhu", "زاخۆ", "زاخو"],
    },
    {
      slug: "ranya",
      city: "ranya",
      kind: "city",
      lat: 36.255,
      lng: 44.8833,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Raparin (Rania)", ckb: "ڕاپەڕین (ڕانیە)", kmr: "Raperîn (Ranye)", ar: "رابرين (رانية)" },
      alt: ["ranya", "rania", "raniya", "ranye", "raparin administration", "ڕانیە", "رانیە", "رانية", "رانيه"],
    },
    {
      slug: "koya",
      city: "koya",
      kind: "city",
      lat: 36.0833,
      lng: 44.6333,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Koya", ckb: "کۆیە", kmr: "Koye", ar: "كويه (كويسنجق)" },
      alt: ["koya", "koye", "koysinjaq", "koy sanjaq", "کۆیە", "كويسنجق", "كوية"],
    },
    {
      slug: "pirmam",
      city: "pirmam",
      kind: "city",
      lat: 36.3667,
      lng: 44.2,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Pirmam", ckb: "پیرمام", kmr: "Pîrmam", ar: "بيرمام" },
      alt: ["pirmam", "piremam", "pirmum", "salahaddin", "masif", "پیرمام", "بيرمام", "مصيف صلاح الدين"],
    },
    {
      slug: "akre",
      city: "akre",
      kind: "city",
      lat: 36.7411,
      lng: 43.8911,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Akre", ckb: "ئاکرێ", kmr: "Akrê", ar: "عقرة" },
      alt: ["akre", "aqrah", "aqra", "akra", "akrê", "ئاکرێ", "عقرة", "عقره"],
    },
    {
      slug: "simel",
      city: "simel",
      kind: "city",
      lat: 36.8611,
      lng: 42.8481,
      runaki: "covered",
      since: "2026-04",
      water: "unknown",
      name: { en: "Simel", ckb: "سێمێل", kmr: "Sêmêl", ar: "سميل" },
      alt: ["simel", "sumel", "semel", "sêmêl", "سێمێل", "سيميل", "سميل"],
    },
  ];
  for (const a of AREAS) a.city = a.city || "erbil";

  /* What people can report. `out` problems turn a neighbourhood red;
     everything else shows as "problems reported".                          */
  const PROBLEMS = {
    electricity: [
      { key: "no_power", out: true },
      { key: "some_houses" },
      { key: "keeps_cutting" },
      { key: "weak_voltage" },
      { key: "cable_damage" },
      { key: "generator" },
      { key: "other_power" },
    ],
    water: [
      { key: "no_water", out: true },
      { key: "low_pressure" },
      { key: "dirty_water" },
      { key: "broken_pipe" },
      { key: "sewage" },
      { key: "other_water" },
    ],
  };

  /* Runaki household tariff, from the KRG announcement of 14 May 2025
     (runaki.gov.krd). Each price applies only to the kWh inside its band.  */
  const TARIFF = [
    { from: 1, to: 400, price: 72 },
    { from: 401, to: 800, price: 108 },
    { from: 801, to: 1200, price: 175 },
    { from: 1201, to: 1600, price: 265 },
    { from: 1601, to: Infinity, price: 350 },
  ];

  function billFor(kwh) {
    let left = Math.max(0, Math.round(kwh));
    let prevTop = 0;
    const lines = [];
    for (const band of TARIFF) {
      if (left <= 0) break;
      const size = band.to === Infinity ? left : band.to - prevTop;
      const used = Math.min(left, size);
      lines.push({ band, kwh: used, cost: used * band.price });
      left -= used;
      prevTop = band.to;
    }
    return { lines, total: lines.reduce((s, l) => s + l.cost, 0) };
  }

  /* How residents can reach each team directly. Private requests (one
     house, or a few) are saved on the server and show up on the team page;
     these numbers are only for people who'd rather call or WhatsApp.
       whatsapp: digits only with the country code, e.g. "9647501234567"
       phone:    the number to call, e.g. "+9647501234567"
     Leave them empty and the buttons simply don't show.                    */
  const TEAM = {
    electricity: { whatsapp: "", phone: "" },
    water: { whatsapp: "", phone: "" },
    hours: {
      en: "Saturday to Thursday, 9:00 to 17:00",
      ckb: "شەممە تا پێنجشەممە، ٩:٠٠ تا ١٧:٠٠",
      kmr: "Şemî heta Pêncşemê, 9:00 heta 17:00",
      ar: "من السبت إلى الخميس، ٩:٠٠ إلى ١٧:٠٠",
    },
  };

  /* Recent news about power and water in Erbil, newest first. Headlines stay
     in the language they were published in; the summary is ours.          */
  const NEWS = [
    {
      date: "2026-05-03",
      outlet: "Rudaw",
      url: "https://rudaw.net/english/kurdistan/03052026",
      title: "Erbil water supply set to meet summer demand as output surges: Official",
      lang: "en",
      head: {
        ckb: "ئاوی هەولێر بەشی پێویستی هاوین دەکات، بەرهەمهێنان زۆر زیادی کردووە: بەرپرسێک",
        kmr: "Ava Hewlêrê dê têra hewcedariya havînê bike, hilberîn pir zêde bûye: Berpirsek",
        ar: "إمدادات المياه في أربيل ستلبّي طلب الصيف مع ارتفاع الإنتاج: مسؤول",
      },
      sum: {
        en: "The emergency water project now gives about 33,000 m³ an hour, and almost 1,000 wells have been shut.",
        ckb: "پڕۆژەی فریاکەوتنی ئاو ئێستا نزیکەی ٣٣ هەزار مەتر سێجا لە کاتژمێرێکدا دەدات و نزیکەی هەزار بیر داخراون.",
        kmr: "Projeya avê ya acîl niha di saetekê de nêzî 33,000 m³ dide, û nêzî 1,000 bîr hatine girtin.",
        ar: "مشروع الماء الطارئ يوفّر الآن نحو ٣٣ ألف متر مكعب في الساعة، وأُغلق قرابة ألف بئر.",
      },
    },
    {
      date: "2026-05-03",
      outlet: "Kurdistan24",
      url: "https://www.kurdistan24.net/en/story/911813/krg-signs-100-billion-dinar-contract-for-three-power-substations-in-erbil",
      title: "KRG Signs 100 Billion Dinar Contract for Three Power Substations in Erbil",
      lang: "en",
      head: {
        ckb: "حکومەتی هەرێم گرێبەستێکی ١٠٠ ملیار دیناری بۆ سێ وێستگەی کارەبا لە هەولێر واژۆ کرد",
        kmr: "HRK peymanek 100 milyar dînarî ji bo sê qereqolên elektrîkê li Hewlêrê îmze kir",
        ar: "حكومة الإقليم توقّع عقدًا بـ١٠٠ مليار دينار لثلاث محطات تحويل كهرباء في أربيل",
      },
      sum: {
        en: "Three new 132 kV substations are to be built in Erbil within two years to cut outages.",
        ckb: "سێ وێستگەی نوێی ١٣٢ کیلۆڤۆڵتی لە ماوەی دوو ساڵدا لە هەولێر دروست دەکرێن بۆ کەمکردنەوەی بڕانی کارەبا.",
        kmr: "Sê qereqolên nû yên 132 kV dê di du salan de li Hewlêrê bên avakirin da ku qutbûn kêm bibin.",
        ar: "ستُبنى ثلاث محطات تحويل جديدة بجهد ١٣٢ كيلوفولت في أربيل خلال عامين لتقليل الانقطاعات.",
      },
    },
    {
      date: "2026-04-23",
      outlet: "Ministry of Electricity, KRG",
      url: "https://gov.krd/moel-en/activities/news-and-press-releases/2026/april/nearly-55-million-citizens-now-enjoy-24-hour-electricity-through-the-runaki-initiative/",
      title: "Nearly 5.5 million citizens now enjoy 24-hour electricity through the Runaki initiative",
      lang: "en",
      head: {
        ckb: "نزیکەی ٥.٥ ملیۆن هاووڵاتی ئێستا لە ڕێگەی پڕۆژەی ڕووناکی ٢٤ کاتژمێر کارەبایان هەیە",
        kmr: "Nêzî 5.5 milyon welatî niha bi saya projeya Runakî 24 saetan kehreba wan heye",
        ar: "نحو ٥٫٥ مليون مواطن ينعمون الآن بكهرباء على مدار ٢٤ ساعة عبر مشروع روناكي",
      },
      sum: {
        en: "Erbil leads Runaki with about 504,000 subscribers. Full coverage is planned by the end of 2026.",
        ckb: "هەولێر بە نزیکەی ٥٠٤ هەزار بەشداربوو لە پێشی ڕووناکییە. پلان وایە تا کۆتایی ٢٠٢٦ هەموو شوێنێک بگرێتەوە.",
        kmr: "Hewlêr bi nêzî 504,000 aboneyan di Runakî de pêşî ye. Plan ew e ku heta dawiya 2026an her der were girtin.",
        ar: "أربيل في مقدمة روناكي بنحو ٥٠٤ آلاف مشترك، والتغطية الكاملة مخطط لها بنهاية ٢٠٢٦.",
      },
    },
    {
      date: "2026-04-23",
      outlet: "Rudaw",
      url: "https://www.rudaw.net/english/kurdistan/230420265",
      title: "Kurdistan Region surpasses 85 percent coverage in 24-hour electricity rollout: Official",
      lang: "en",
      head: {
        ckb: "هەرێمی کوردستان لە کارەبای ٢٤ کاتژمێریدا لە ٨٥٪ تێپەڕی: بەرپرسێک",
        kmr: "Herêma Kurdistanê di kehreba 24 saetan de ji %85 derbas bû: Berpirsek",
        ar: "إقليم كوردستان يتجاوز ٨٥٪ في تغطية الكهرباء على مدار ٢٤ ساعة: مسؤول",
      },
      sum: {
        en: "About 85% of households now have power around the clock, and nearly 6,000 neighbourhood generators have been switched off.",
        ckb: "نزیکەی ٨٥٪ی ماڵەکان ئێستا شەو و ڕۆژ کارەبایان هەیە، و نزیکەی ٦ هەزار مۆلیدەی گەڕەک کوژێنراونەتەوە.",
        kmr: "Nêzî %85 ê malan niha şev û roj kehreba wan heye, û nêzî 6,000 jeneratorên taxan hatine vemirandin.",
        ar: "نحو ٨٥٪ من المنازل لديها الآن كهرباء على مدار الساعة، وأُطفئ قرابة ٦ آلاف مولدة أهلية.",
      },
    },
    {
      date: "2026-03-25",
      outlet: "Ministry of Electricity, KRG",
      url: "https://gov.krd/moel-en/activities/news-and-press-releases/2026/march/half-of-the-runaki-households-in-kurdistan-billed-less-than-36-000-iqd-in-february/",
      title: "Half of the Runaki households in Kurdistan billed less than 36,000 IQD in February",
      lang: "en",
      head: {
        ckb: "پسوولەی نیوەی ماڵەکانی ڕووناکی لە کوردستان بۆ شوبات کەمتر بوو لە ٣٦ هەزار دینار",
        kmr: "Fatûreya nîvê malên Runakî li Kurdistanê ji bo Sibatê kêmtir ji 36,000 dînar bû",
        ar: "نصف منازل روناكي في كوردستان دفعت أقل من ٣٦ ألف دينار عن شباط",
      },
      sum: {
        en: "Half of Runaki homes paid under 36,000 IQD for February, and about 80% now pay less than they used to for the grid and generators together.",
        ckb: "نیوەی ماڵەکانی ڕووناکی بۆ مانگی شوبات کەمتر لە ٣٦ هەزار دینار پارەیان دا، و نزیکەی ٨٠٪ ئێستا کەمتر لە جاران دەدەن بۆ کارەبای نیشتمانی و مۆلیدە پێکەوە.",
        kmr: "Nîvê malên Runakî ji bo Sibatê kêmtir ji 36,000 dînar dan, û nêzî %80 niha ji berê kêmtir didin ji bo tora neteweyî û jeneratoran bi hev re.",
        ar: "دفع نصف منازل روناكي أقل من ٣٦ ألف دينار عن شهر شباط، ونحو ٨٠٪ يدفعون الآن أقل مما كانوا يدفعونه للوطنية والمولدات معًا.",
      },
    },
    {
      date: "2025-11-26",
      outlet: "Rudaw",
      url: "https://www.rudaw.net/english/kurdistan/261120251",
      title: "Drone attack targets Sulaimani's key gas field, causes outage",
      lang: "en",
      head: {
        ckb: "هێرشی درۆن کێڵگە گازە سەرەکییەکەی سلێمانی کردە ئامانج و کارەبا بڕا",
        kmr: "Êrişa dronê qada gazê ya sereke ya Silêmaniyê kir armanc û kehreba qut bû",
        ar: "هجوم بطائرة مسيّرة يستهدف حقل الغاز الرئيسي في السليمانية ويتسبب بانقطاع الكهرباء",
      },
      sum: {
        en: "A drone hit the Khor Mor gas field, cutting most gas to the power plants. Parts of Erbil lost power.",
        ckb: "درۆنێک کێڵگەی گازی کۆرمۆری پێکا و زۆربەی گازی وێستگەکانی کارەبا بڕا. بەشێک لە هەولێر بێ کارەبا مایەوە.",
        kmr: "Dronekê li qada gazê ya Xor Mor da û piraniya gaza santralan qut bû. Beşek ji Hewlêrê bê kehreba ma.",
        ar: "استهدفت طائرة مسيّرة حقل كورمور للغاز فانقطع معظم الغاز عن محطات الكهرباء، وانقطعت الكهرباء عن أجزاء من أربيل.",
      },
    },
    {
      date: "2025-11-06",
      outlet: "Rudaw",
      url: "https://www.rudaw.net/english/business/061120251",
      title: "PM Barzani inaugurates final phase of $200 million water project in Erbil",
      lang: "en",
      head: {
        ckb: "سەرۆکوەزیران بارزانی قۆناغی کۆتایی پڕۆژەیەکی ئاوی ٢٠٠ ملیۆن دۆلاری لە هەولێر کردەوە",
        kmr: "Serokwezîr Barzanî qonaxa dawî ya projeyeke avê ya 200 milyon dolarî li Hewlêrê vekir",
        ar: "رئيس الوزراء بارزاني يفتتح المرحلة الأخيرة من مشروع مياه بقيمة ٢٠٠ مليون دولار في أربيل",
      },
      sum: {
        en: "The last phase of Erbil's $200 million emergency water project opened, covering 40 neighbourhoods.",
        ckb: "قۆناغی کۆتایی پڕۆژەی فریاکەوتنی ئاوی هەولێر بە تێچووی ٢٠٠ ملیۆن دۆلار کرایەوە و ٤٠ گەڕەک دەگرێتەوە.",
        kmr: "Qonaxa dawî ya projeya avê ya acîl a Hewlêrê bi lêçûna 200 mîlyon dolaran hat vekirin û 40 taxan digire.",
        ar: "افتُتحت المرحلة الأخيرة من مشروع الماء الطارئ في أربيل بكلفة ٢٠٠ مليون دولار، وتشمل ٤٠ حيًّا.",
      },
    },
    {
      date: "2025-08-29",
      outlet: "Rudaw",
      url: "https://www.rudaw.net/english/kurdistan/29082025",
      title: "Dry wells force Erbil neighbourhood to truck in water",
      lang: "en",
      head: {
        ckb: "وشکبوونی بیرەکان گەڕەکێکی هەولێری ناچار کرد ئاو بە تانکەر بهێنێت",
        kmr: "Bîrên ziwa taxeke Hewlêrê neçar kirin ku avê bi tankeran bînin",
        ar: "جفاف الآبار يجبر حيًّا في أربيل على جلب المياه بالصهاريج",
      },
      sum: {
        en: "Three wells dried up in a north-western neighbourhood, and families relied on water tankers.",
        ckb: "سێ بیر لە گەڕەکێکی باکووری ڕۆژئاوا وشک بوون و خێزانەکان پشتیان بە تانکەری ئاو بەست.",
        kmr: "Li taxeke bakurê rojava sê bîr ziwa bûn û malbat bi tankerên avê man.",
        ar: "جفّت ثلاث آبار في حيّ شمال غربي، واعتمدت العائلات على صهاريج الماء.",
      },
    },
  ];

  const LINKS = {
    runaki: "https://runaki.gov.krd/en/",
    runakiCalc: "https://runaki.gov.krd/en/calculator/",
    epsule: "https://epsule.gov.krd/en/",
    water: "https://gov.krd/moawr-en/",
  };

  root.EU = root.EU || {};
  /* A headline in the reader's language. Most outlets publish in English, so
     each story keeps its original title and, where we have them, the same
     headline in Sorani, Kurmanji and Arabic. `original` says when the
     article behind the link is in another language than the page. */
  function headline(n, lang) {
    const l = lang || root.EU.lang;
    const own = n.lang || "en";
    if (l === own) return { text: n.title, lang: own, original: false };
    const t = n.head && n.head[l];
    return t ? { text: t, lang: l, original: own } : { text: n.title, lang: own, original: false };
  }

  Object.assign(root.EU, {
    AREAS,
    CITIES,
    city: (slug) => CITIES.find((c) => c.slug === slug) || null,
    PROBLEMS,
    TARIFF,
    TEAM,
    NEWS,
    LINKS,
    headline,
    billFor,
    area: (slug) => AREAS.find((a) => a.slug === slug) || null,
  });
})(typeof window !== "undefined" ? window : globalThis);
