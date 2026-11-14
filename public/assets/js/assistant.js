/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: the assistant
  -------------------------------
  A small question-answering helper that runs entirely in the browser.
  No API key, no server, nothing leaves the visitor's device.

  How it works
    1. detectLang()  works out which of the four languages the question is in:
         Arabic script → Sorani or Arabic, by letters (ە ۆ ێ ڵ ڕ vs ة ى ال…)
                         and by common words.
         Latin script  → English or Kurmanji, by letters (ê î û ç ş) and words.
                         Sorani typed in Latin letters ("karaba haya?") is
                         understood too and answered in Latin Kurdish.
    2. understand()  finds the neighbourhood, the service (power/water),
                     any number (for bills) and the intent, using keyword
                     lists in all four languages. Follow-up questions
                     ("and the water?") reuse the last neighbourhood.
    3. answer()      builds the reply from live data in the language of
                     the question, not the page language.

  To teach it a new word, add it to the right list in WORDS below.
*/

(function () {
  "use strict";
  const EU = window.EU;
  const N = (s) => EU.normalize(s);

  /* ------------------------------------------------------------------ *
   * Vocabulary. Everything is normalised the same way as the question,
   * so write words naturally (with ê, ە, ة…).
   * ------------------------------------------------------------------ */
  const WORDS = {
    electricity: [
      "cuts",
      "power cuts",
      "the cuts",
      "القطع",
      "انقطاعات",
      "بڕانەکان",
      "qutbûn",
      "dark",
      "darkness",
      "pitch black",
      "bulb",
      "bulbs",
      "گڵۆپ",
      "گڵۆپەکان",
      "تاریکە",
      "tarîk",
      "tarî",
      "ظلمة",
      "مظلم",
      "karaba",
      "karabay",
      "karabakan",
      "kareba",
      "kehraba",
      "elec",
      "light nya",
      "electricity",
      "electric",
      "power",
      "light",
      "lights",
      "current",
      "outage",
      "blackout",
      "kehreba",
      "kehrebe",
      "kareba",
      "karaba",
      "kerebe",
      "elektrik",
      "ceryan",
      "cereyan",
      "کارەبا",
      "کارەبای",
      "کەهرەبا",
      "کارەباکە",
      "کارەبامان",
      "كهرباء",
      "الكهرباء",
      "كهربا",
      "الكهربا",
      "ضوء",
      "الضوء",
      "تيار",
      "الوطنية",
    ],
    water: [
      "awi",
      "awakan",
      "awaka",
      "boriy",
      "bori",
      "water",
      "tap",
      "pressure",
      "pipe",
      "sewage",
      "sewer",
      "av",
      "ava",
      "avê",
      "aw",
      "awi",
      "awy",
      "ئاو",
      "ئاوی",
      "ئاوەکە",
      "ئاومان",
      "بۆری",
      "ماء",
      "الماء",
      "مي",
      "المي",
      "مياه",
      "المياه",
      "ماي",
      "الماي",
      "الاسالة",
      "اسالة",
    ],
    out: [
      "cuts",
      "nothing works",
      "not working",
      "doesn't work",
      "doesnt work",
      "isn't working",
      "stopped working",
      "is off again",
      "off again",
      "القطع",
      "انقطاعات",
      "ما يشتغل",
      "ماكو شي يشتغل",
      "کار ناکات",
      "هیچ کار ناکات",
      "naxebite",
      "tiştek naxebite",
      "without",
      "keeps cutting",
      "cutting out",
      "دەبڕێت",
      "دەبڕێ",
      "دەبڕدرێت",
      "تنقطع",
      "ينقطع",
      "diqete",
      "diqetê",
      "dark",
      "darkness",
      "pitch black",
      "تاریکە",
      "tarî ye",
      "ظلمة",
      "مظلمة",
      "nya",
      "niya",
      "nia",
      "nie",
      "nyya",
      "brrawa",
      "brawa",
      "brra",
      "qata",
      "qat",
      "qatbwa",
      "nemawa",
      "chuwa",
      "rroyshtwa",
      "royshtwa",
      "no light",
      "no power",
      "no water",
      "no",
      "off",
      "out",
      "cut",
      "down",
      "gone",
      "none",
      "not",
      "tune",
      "tuneye",
      "nine",
      "qut",
      "qutbû",
      "hatiye birîn",
      "çûye",
      "niya",
      "nya",
      "nia",
      "nîye",
      "نییە",
      "نیه",
      "نیە",
      "بڕاوە",
      "بڕا",
      "ڕۆیشتووە",
      "چووە",
      "ماكو",
      "ماكو",
      "مقطوع",
      "مقطوعة",
      "انقطع",
      "انقطاع",
      "طافي",
      "طافية",
      "راحت",
      "راح",
      "لا يوجد",
      "ما في",
      "مافي",
    ],
    where: [
      "anyone else",
      "anybody else",
      "other people",
      "who else",
      "kwe",
      "la kwe",
      "kam",
      "kame",
      "chi shwenek",
      "shwen",
      "garakakan",
      "where",
      "which",
      "areas",
      "neighbourhoods",
      "neighborhoods",
      "places",
      "anywhere",
      "list",
      "city",
      "erbil",
      "li ku",
      "ku derê",
      "kijan",
      "kîjan",
      "kwe",
      "kwê",
      "kwi",
      "hewler",
      "hewlêr",
      "bajêr",
      "کوێ",
      "کوی",
      "کام",
      "کامە",
      "شوێن",
      "گەڕەکەکان",
      "هەولێر",
      "اين",
      "أين",
      "وين",
      "وين",
      "اي",
      "أي",
      "مناطق",
      "المناطق",
      "احياء",
      "الأحياء",
      "اربيل",
      "أربيل",
    ],
    bill: [
      "pswla",
      "psula",
      "pswle",
      "psule",
      "nrx",
      "nirx",
      "chande",
      "chanda",
      "chand",
      "para",
      "gran",
      "harzan",
      "bill",
      "cost",
      "costs",
      "price",
      "prices",
      "tariff",
      "how much",
      "iqd",
      "dinar",
      "dinars",
      "kwh",
      "kilowatt",
      "unit",
      "units",
      "expensive",
      "cheap",
      "fatûre",
      "fatura",
      "fature",
      "biha",
      "buha",
      "çiqas",
      "ciqas",
      "çend",
      "chand",
      "chend",
      "pare",
      "pere",
      "nirx",
      "پسوولە",
      "پسووڵە",
      "پسوله",
      "نرخ",
      "چەند",
      "دینار",
      "کیلۆوات",
      "کیلووات",
      "پارە",
      "گران",
      "هەرزان",
      "یەکە",
      "فاتورة",
      "فاتوره",
      "الفاتورة",
      "سعر",
      "اسعار",
      "أسعار",
      "كم",
      "تكلفة",
      "كلفة",
      "تعرفة",
      "التعرفة",
      "دينار",
      "كيلو",
      "كيلوواط",
      "وحدة",
      "غالي",
    ],
    pay: [
      "bdam",
      "para bdam",
      "pswla bdam",
      "parada",
      "paradan",
      "pay",
      "paying",
      "payment",
      "epsule",
      "e-psule",
      "psule",
      "fastpay",
      "fib",
      "asiapay",
      "bidim",
      "dayîn",
      "dayin",
      "bide",
      "bidin",
      "پارەدان",
      "پارە بدەم",
      "پارەی بدەم",
      "ئی پسوولە",
      "پسوولە بدەم",
      "چۆن بدەم",
      "بیدەم",
      "بدەم",
      "دانی",
      "دفع",
      "ادفع",
      "أدفع",
      "تسديد",
      "اسدد",
      "أسدد",
      "سداد",
    ],
    howareyou: [
      "how are you",
      "how r u",
      "how are u",
      "hru",
      "how is it going",
      "hows it going",
      "how you doing",
      "you ok",
      "are you ok",
      "whats up",
      "what's up",
      "sup",
      "choni",
      "chony",
      "chonit",
      "chonyt",
      "chon i",
      "chonin",
      "bashi",
      "bashy",
      "bashit",
      "bashyt",
      "bash i",
      "ahwal",
      "ahwalt",
      "ahwalit",
      "ahwalt chona",
      "ahwal chona",
      "xoshi",
      "xoshit",
      "khoshi",
      "chakit",
      "chaki",
      "basht",
      "tu çawa yî",
      "tu cawa yi",
      "çawa yî",
      "cawa yi",
      "çawanî",
      "cawani",
      "baş î",
      "bas i",
      "tu baş î",
      "keyfa te",
      "çi heye çi tune",
      "ci heye ci tune",
      "چۆنی",
      "چۆنیت",
      "چونی",
      "باشی",
      "باشیت",
      "ئەحواڵت",
      "ئەحواڵ",
      "ئەحوال",
      "خۆشی",
      "چاکیت",
      "چۆنن",
      "شلونك",
      "شلونج",
      "شلونكم",
      "كيف حالك",
      "كيفك",
      "كيف الحال",
      "شخبارك",
      "شخبارج",
      "اخبارك",
      "أخبارك",
      "عساك بخير",
    ],
    bye: [
      "good night",
      "goodnight",
      "night night",
      "şev baş",
      "sev bas",
      "shaw bash",
      "shaw bas",
      "شەو باش",
      "تصبح على خير",
      "تصبحون على خير",
      "bye",
      "goodbye",
      "good bye",
      "see you",
      "see ya",
      "cya",
      "good night",
      "later",
      "xwahafiz",
      "xwa hafiz",
      "khwahafiz",
      "khwa hafiz",
      "xwa lagal",
      "xwat lagal",
      "shaw bash",
      "shawt bash",
      "bi xatirê te",
      "bi xatire te",
      "xatirê te",
      "xatire te",
      "şev baş",
      "sev bas",
      "oxir be",
      "oxir",
      "خوا حافیز",
      "خواحافیز",
      "خوات لەگەڵ",
      "شەو باش",
      "شەوت باش",
      "مع السلامة",
      "مع السلامه",
      "باي",
      "تصبح على خير",
      "الله وياك",
      "في امان الله",
    ],
    whoami: [
      "are you an ai",
      "an ai",
      "ai",
      "artificial intelligence",
      "bot",
      "a robot",
      "ڕۆبۆت",
      "ڕۆبۆتیت",
      "زیرەکی دەستکرد",
      "ذكاء اصطناعي",
      "ذكاء صناعي",
      "روبوت",
      "robot î",
      "tu robot î",
      "who are you",
      "what are you",
      "your name",
      "whats your name",
      "what is your name",
      "are you ai",
      "are you a bot",
      "are you human",
      "are you real",
      "are you chatgpt",
      "robot",
      "chatbot",
      "to kei",
      "to kêy",
      "to kit",
      "to ki",
      "nawt chiya",
      "nawt chya",
      "naw chiya",
      "to chit",
      "to chiyt",
      "tu kî yî",
      "tu ki yi",
      "navê te",
      "nave te",
      "navê te çi ye",
      "tu çi yî",
      "تۆ کێیت",
      "تۆ کێی",
      "ناوت چییە",
      "ناوت چیە",
      "تۆ چیت",
      "من انت",
      "من أنت",
      "شنو اسمك",
      "ما اسمك",
      "شسمك",
      "انت روبوت",
      "أنت روبوت",
      "انت انسان",
    ],
    news: [
      "news",
      "latest",
      "whats new",
      "what's new",
      "what is new",
      "updates",
      "update",
      "headlines",
      "happening",
      "nûçe",
      "nuce",
      "nûçeyên",
      "nuceyen",
      "çi heye",
      "nû",
      "hawal",
      "hewal",
      "hawalakan",
      "xabar",
      "xabarakan",
      "taza",
      "chi taza",
      "chi hayaw",
      "chi ru dadat",
      "chi rudawa",
      "هەواڵ",
      "هەواڵەکان",
      "هەواڵی",
      "تازە",
      "چی تازە",
      "چی ڕوودەدات",
      "دوایین",
      "اخبار",
      "أخبار",
      "الأخبار",
      "الاخبار",
      "خبر",
      "شنو الجديد",
      "ما الجديد",
      "آخر",
      "اخر",
      "مستجدات",
    ],
    private: [
      "دراوسێکان",
      "دراوسێکانمان",
      "دراوسێکەمان",
      "دراوسێ هەیەتی",
      "cîran",
      "cîranan",
      "cîranên me",
      "الجيران",
      "جيراننا",
      "الجيران عدهم",
      "الجار عنده",
      "only my house",
      "just my house",
      "my house only",
      "only at my house",
      "only in my house",
      "only at home",
      "only in our house",
      "just our house",
      "only our house",
      "only us",
      "only me",
      "just me",
      "just us",
      "my home",
      "one house",
      "our house",
      "only our",
      "neighbours have",
      "neighbors have",
      "the neighbours have",
      "next door has",
      "appointment",
      "visit",
      "technician",
      "send someone",
      "come and check",
      "come to my",
      "electrician",
      "call me back",
      "callback",
      "tenê mala min",
      "tene mala min",
      "mala min",
      "mala me",
      "tenê em",
      "serdan",
      "hosta",
      "wesata",
      "tanha malakam",
      "tanha mali min",
      "malakam",
      "malakaman",
      "mali mn",
      "mali min",
      "mali ema",
      "tanha ema",
      "tanya malakam",
      "wastay karaba",
      "wasta",
      "sardan",
      "maw'id",
      "تەنها ماڵەکەم",
      "تەنها ماڵەکەی من",
      "ماڵەکەم",
      "ماڵەکەمان",
      "ماڵی من",
      "ماڵی ئێمە",
      "تەنها ئێمە",
      "سەردان",
      "وەستا",
      "وەستای کارەبا",
      "کاتێک دابنێن",
      "بيتي فقط",
      "بس بيتي",
      "بيتي",
      "بيتنا",
      "عندي بس",
      "موعد",
      "زيارة",
      "فني",
      "كهربائي",
      "اتصلوا بي",
      "يتصلون",
    ],
    contact: [
      "contact",
      "phone number",
      "number",
      "whatsapp",
      "call you",
      "call the team",
      "team",
      "email",
      "reach you",
      "talk to someone",
      "human",
      "real person",
      "support",
      "tîm",
      "tim",
      "telefon",
      "hejmar",
      "jimar",
      "peywendî",
      "peywendi",
      "zhmara",
      "zhmaray",
      "zhmarat",
      "paywandi",
      "peywandi",
      "taym",
      "tymaka",
      "timaka",
      "wats",
      "پەیوەندی",
      "ژمارە",
      "ژمارەی",
      "تیم",
      "تیمەکە",
      "واتسئاپ",
      "واتساپ",
      "تەلەفۆن",
      "تواصل",
      "اتصل",
      "رقم",
      "رقمكم",
      "الفريق",
      "واتساب",
      "واتس",
      "دعم",
    ],
    privacy: [
      "privacy",
      "private data",
      "my data",
      "personal data",
      "personal info",
      "track",
      "tracking",
      "location data",
      "is it safe",
      "anonymous",
      "my name",
      "nepenî",
      "nepeni",
      "daneyên min",
      "zanyari",
      "zaniyari",
      "nhenî",
      "nheni",
      "تایبەتمەندی",
      "زانیاری کەسی",
      "زانیارییەکانم",
      "نهێنی",
      "خصوصية",
      "الخصوصية",
      "بياناتي",
      "بيانات شخصية",
      "مجهول",
    ],
    trust: [
      "how does it work",
      "how it works",
      "how does this work",
      "confirm",
      "confirmed",
      "not confirmed",
      "unconfirmed",
      "fake",
      "spam",
      "lie",
      "lying",
      "true",
      "accurate",
      "reliable",
      "trust",
      "grey",
      "gray",
      "red",
      "green",
      "blue",
      "colour",
      "colours",
      "color",
      "colors",
      "what does",
      "mean",
      "me too",
      "fine here",
      "çawa dixebite",
      "cawa dixebite",
      "piştrast",
      "pistrast",
      "rast",
      "derew",
      "reng",
      "chon kar dakat",
      "chon esh dakat",
      "pshtrast",
      "pishtrast",
      "rast",
      "dro",
      "drro",
      "rang",
      "sur",
      "kask",
      "xolamesh",
      "minish",
      "lay min basha",
      "چۆن کار دەکات",
      "پشتڕاست",
      "پشتراست",
      "ڕاست",
      "درۆ",
      "ڕەنگ",
      "سوور",
      "سەوز",
      "شین",
      "خۆڵەمێشی",
      "منیش",
      "لای من باشە",
      "كيف يعمل",
      "تأكيد",
      "مؤكد",
      "مزيف",
      "كذب",
      "صحيح",
      "دقيق",
      "رمادي",
      "احمر",
      "أحمر",
      "اخضر",
      "ازرق",
      "اللون",
      "الألوان",
      "يعني",
    ],
    map: ["map", "maps", "nexşe", "nexse", "naxsha", "nexsha", "naxshe", "نەخشە", "خريطة", "الخريطة", "خارطة"],
    areas: [
      "neighbourhoods",
      "neighborhoods",
      "which areas",
      "what areas",
      "areas covered",
      "list",
      "all areas",
      "how many areas",
      "coverage",
      "tax",
      "taxan",
      "garakakan",
      "hamu garakakan",
      "hemû tax",
      "گەڕەکەکان",
      "هەموو گەڕەکەکان",
      "ناوچەکان",
      "الأحياء",
      "الاحياء",
      "المناطق",
      "كل المناطق",
    ],
    language: [
      "language",
      "languages",
      "english",
      "arabic",
      "kurdish",
      "sorani",
      "kurmanji",
      "badini",
      "translate",
      "speak",
      "ziman",
      "zimanê",
      "kurdî",
      "erebî",
      "îngilîzî",
      "zman",
      "zmani",
      "kurdi",
      "arabi",
      "inglizi",
      "englizi",
      "qsa",
      "qsa daka",
      "زمان",
      "کوردی",
      "عەرەبی",
      "ئینگلیزی",
      "قسە",
      "لغة",
      "اللغة",
      "عربي",
      "انكليزي",
      "انجليزي",
      "كردي",
      "تتكلم",
    ],
    offline: [
      "offline",
      "no internet",
      "without internet",
      "internet",
      "no connection",
      "data",
      "wifi",
      "înternet",
      "internet nîne",
      "bê înternet",
      "internet nya",
      "be internet",
      "ئینتەرنێت",
      "ئینتەرنێت نییە",
      "بێ ئینتەرنێت",
      "انترنت",
      "الانترنت",
      "بدون انترنت",
      "ماكو انترنت",
    ],
    danger: [
      "wire hanging",
      "hanging low",
      "low wire",
      "wire on the ground",
      "cable on the ground",
      "kablo ket",
      "kabloyek ket",
      "ketiye kolanê",
      "têl ket",
      "çirûsk",
      "çirisk",
      "dişewite",
      "teqiya",
      "sparks",
      "spark",
      "sparking",
      "fire",
      "burning",
      "smoke",
      "smoking",
      "fallen cable",
      "cable down",
      "wire down",
      "cable fell",
      "wire fell",
      "cable is down",
      "pole fell",
      "pole is down",
      "hanging wire",
      "hanging cable",
      "exposed wire",
      "bare wire",
      "live wire",
      "electrocuted",
      "shock",
      "danger",
      "dangerous",
      "emergency",
      "explosion",
      "exploded",
      "transformer blew",
      "smell of burning",
      "agir",
      "şewat",
      "sewat",
      "dû",
      "xeternak",
      "agr",
      "sotan",
      "dukal",
      "metrsi",
      "mitirsi",
      "taqinawa",
      "kabl kawtwa",
      "ئاگر",
      "سووتان",
      "دووکەڵ",
      "مەترسی",
      "تەقینەوە",
      "تەقیەوە",
      "کێبڵ کەوتووە",
      "وایەر کەوتووە",
      "کارەبا گرتی",
      "پریشک",
      "بۆنی سووتان",
      "حريق",
      "نار",
      "شرارة",
      "شرار",
      "دخان",
      "سلك ساقط",
      "وقع السلك",
      "سلك مكشوف",
      "خطر",
      "طوارئ",
      "انفجار",
      "انفجرت",
      "صعقة",
      "كهربني",
      "ريحة احتراق",
    ],
    // facts people ask about Runaki and the mains
    callcentre: [
      "centre number",
      "center number",
      "navenda",
      "hejmara navendê",
      "hejmara",
      "سەنتەری پەیوەندی",
      "سەنتەر",
      "ژمارەی",
      "مركز اتصال",
      "مركز الاتصال",
      "رقم",
      "call centre",
      "call center",
      "hotline",
      "phone number",
      "number to call",
      "who do i call",
      "who can i call",
      "contact number",
      "1992",
      "hejmara telefonê",
      "kê bigerim",
      "zhmaray paywandi",
      "zhmara",
      "ژمارەی پەیوەندی",
      "ژمارەی تەلەفۆن",
      "پەیوەندی بە کێ بکەم",
      "رقم الاتصال",
      "رقم الهاتف",
      "شنو الرقم",
      "رقم الطوارئ للكهرباء",
      "خط ساخن",
    ],
    deadline: [
      "how many days",
      "days to pay",
      "days do i have",
      "how long to pay",
      "كم يوم",
      "چەند ڕۆژ",
      "çend roj",
      "chand rozh",
      "نەداوە",
      "nedaye",
      "how many days to pay",
      "how long do i have to pay",
      "deadline",
      "late payment",
      "pay late",
      "50 days",
      "didn't pay",
      "didnt pay",
      "not paid",
      "unpaid",
      "dereng",
      "nedaye",
      "nadra",
      "nam dawa",
      "نەمداوە",
      "نەدراوە",
      "دواکەوت",
      "چەند ڕۆژم هەیە",
      "ما دفعت",
      "ما دافع",
      "متأخر",
      "كم يوم للدفع",
      "مهلة الدفع",
    ],
    cutoff: [
      "بڕیم",
      "بڕیان",
      "kehreb qut kirin",
      "qut kirin",
      "cut me off",
      "cut us off",
      "disconnected",
      "disconnect",
      "they cut my",
      "cut off",
      "qut kirin",
      "qutkirin",
      "brrinyan",
      "بڕییان",
      "بڕدرا",
      "قطعوا",
      "فصلوا",
      "انفصلت",
    ],
    olddebt: [
      "old debt",
      "debt",
      "arrears",
      "discount",
      "pre-runaki",
      "deyn",
      "deyna kevn",
      "daxistin",
      "qarz",
      "qarzi kon",
      "dashkandn",
      "قەرز",
      "قەرزی کۆن",
      "داشکاندن",
      "دين",
      "ديون",
      "الديون القديمة",
      "خصم",
      "تخفيض",
    ],
    register: [
      "moved in",
      "in my name",
      "my name",
      "new tenant",
      "new owner",
      "tenant",
      "bi navê min",
      "ba nawi xom",
      "بە ناوی خۆم",
      "کرێچی",
      "باسمي",
      "مستأجر",
      "مالك جديد",
      "register",
      "registration",
      "sign up",
      "kyc",
      "submit my info",
      "join runaki",
      "tomar",
      "tomarkirin",
      "tomar bikim",
      "tomarkrdn",
      "tomar bkam",
      "تۆمار",
      "تۆمارکردن",
      "خۆتۆمارکردن",
      "تسجيل",
      "اسجل",
      "أسجل",
      "التسجيل",
    ],
    meter: [
      "smart meter",
      "meter",
      "the meter",
      "electric meter",
      "saet",
      "saeta jîr",
      "mitar",
      "mitari zirak",
      "مێتەر",
      "مێتەری زیرەک",
      "عداد",
      "العداد",
      "العداد الذكي",
      "مقياس",
    ],
    overpaid: [
      "twice",
      "two times",
      "double",
      "by mistake",
      "مرتين",
      "بالغلط",
      "دوو جار",
      "بە هەڵە",
      "du car",
      "bi xeletî",
      "paid twice",
      "overpaid",
      "paid too much",
      "refund",
      "money back",
      "missed the collector",
      "collector",
      "du car da",
      "zêde da",
      "pere vegere",
      "du jar dam",
      "zyatr dam",
      "دوو جار دام",
      "زیاترم دا",
      "پارەکەم بگەڕێتەوە",
      "پارەکۆکەرەوە",
      "دفعت مرتين",
      "دفعت زيادة",
      "استرجاع",
      "الجابي",
    ],
    runakiwhen: [
      "when will runaki",
      "runaki come",
      "runaki reach",
      "runaki to our",
      "our area runaki",
      "cancel runaki",
      "runaki cancelled",
      "runaki be cancelled",
      "court",
      "runakî kengî",
      "ڕووناکی کەی",
      "ڕووناکی دێت",
      "روناكي متى",
      "متى روناكي",
      "إلغاء روناكي",
      "الغاء روناكي",
      "المحكمة",
    ],
    cancel: [
      "cancel",
      "cancelled",
      "stop",
      "end",
      "betal",
      "hallwashandnawa",
      "هەڵوەشاندنەوە",
      "إلغاء",
      "الغاء",
      "يلغون",
    ],
    tanker: [
      "tanker",
      "water truck",
      "truck of water",
      "buy water",
      "water delivery",
      "tanker price",
      "tanker",
      "tankera avê",
      "av bikirim",
      "tankar",
      "aw bkrm",
      "تانکەر",
      "ئاو بکڕم",
      "تانكر",
      "صهريج",
      "تنكر",
      "اشتري ماي",
      "اشتري ماء",
      "سيارة ماء",
    ],
    connect: [
      "new connection",
      "connect",
      "connection",
      "subscription",
      "subscribe",
      "new house",
      "girêdan",
      "abone",
      "bastnawa",
      "بەستنەوە",
      "بەشداربوون",
      "ماڵی نوێ",
      "اشتراك",
      "ربط",
      "توصيل",
      "بيت جديد",
    ],
    // "here", "in my area"
    here: [
      "here",
      "my area",
      "my neighbourhood",
      "my neighborhood",
      "our area",
      "our street",
      "where i live",
      "li vir",
      "li cem me",
      "taxa me",
      "lera",
      "lay ema",
      "garakakam",
      "لێرە",
      "لای ئێمە",
      "گەڕەکەکەم",
      "گەڕەکەکەمان",
      "هنا",
      "عندنا",
      "منطقتنا",
      "حيّنا",
      "حينا",
    ],
    // worn out
    tired: [
      "tired",
      "sick of",
      "fed up",
      "exhausted",
      "had enough",
      "so annoying",
      "annoying",
      "frustrating",
      "every single day",
      "again and again",
      "unbearable",
      "can't take",
      "cant take",
      "westiyam",
      "bêzar",
      "bezar",
      "aciz",
      "êdî bes e",
      "edi bes e",
      "mandu",
      "manduy",
      "bezar bum",
      "bezarm",
      "ماندوو",
      "ماندووم",
      "بێزار",
      "بێزارم",
      "وەڕز",
      "بەسە",
      "تاقەتم نەما",
      "تعبت",
      "تعبنا",
      "زهقت",
      "زهقنا",
      "مليت",
      "ملينا",
      "طفح الكيل",
      "ما نتحمل",
      "ما اتحمل",
      "مزعج",
    ],
    // someone vulnerable at home
    care: [
      "medicine",
      "medication",
      "insulin",
      "oxygen",
      "nebuliser",
      "nebulizer",
      "dialysis",
      "medical device",
      "wheelchair",
      "newborn",
      "baby",
      "elderly",
      "my mother is sick",
      "my father is sick",
      "disabled",
      "derman",
      "însulîn",
      "insulin",
      "oksîjen",
      "pitik",
      "nexweş",
      "nexwes",
      "kal û pîr",
      "darman",
      "dermana",
      "mndal",
      "nexosh",
      "naxosh",
      "دەرمان",
      "ئەنسولین",
      "ئۆکسجین",
      "منداڵی ساوا",
      "نەخۆش",
      "بەتەمەن",
      "پیر",
      "دواء",
      "دوا",
      "انسولين",
      "أنسولين",
      "اوكسجين",
      "أكسجين",
      "رضيع",
      "طفل صغير",
      "مريض",
      "مريضة",
      "كبار السن",
      "جهاز طبي",
    ],
    // heat
    heat: [
      "heat",
      "hot",
      "so hot",
      "too hot",
      "boiling",
      "heatwave",
      "summer",
      "cool down",
      "keep cool",
      "stay cool",
      "germ",
      "germa",
      "germê",
      "pir germ",
      "garm",
      "garma",
      "garmaya",
      "گەرما",
      "گەرم",
      "گەرمایە",
      "زۆر گەرمە",
      "حر",
      "الحر",
      "حار",
      "شوب",
      "حرارة",
      "موجة حر",
    ],
    // food in the fridge
    fridge: [
      "fridge",
      "freezer",
      "refrigerator",
      "food spoil",
      "food go bad",
      "food safe",
      "meat",
      "milk go off",
      "sarinc",
      "cemidandin",
      "xwarin xera",
      "salaja",
      "sallaja",
      "frizar",
      "سەلاجە",
      "سەلاجەکە",
      "فریزەر",
      "خواردنەکە خراپ",
      "ثلاجة",
      "الثلاجة",
      "براد",
      "البراد",
      "فريزر",
      "الأكل يخرب",
      "الاكل يخرب",
      "اللحم",
    ],
    // using less electricity
    save: [
      "save",
      "saving",
      "tips",
      "advice",
      "lower bill",
      "kêm bikim",
      "kêmkirin",
      "کەم بکەمەوە",
      "کەمکردنەوە",
      "کەمی بکەمەوە",
      "اقلل",
      "أقلل",
      "تقليل",
      "نقلل",
      "اخفف",
      "save electricity",
      "save power",
      "use less",
      "lower my bill",
      "reduce my bill",
      "reduce the bill",
      "bill lower",
      "cut my bill",
      "save money",
      "energy saving",
      "saving tips",
      "air conditioner use",
      "ac use",
      "teserûf",
      "teserûfa",
      "fatûre kêm",
      "kêmtir bi kar",
      "paşakawt",
      "pashakawt",
      "kamkrdnaway pswla",
      "پاشەکەوت",
      "کەمکردنەوەی پسوولە",
      "کەمتر بەکاربهێنم",
      "پسوولەکەم کەم بکەمەوە",
      "توفير",
      "اوفر",
      "أوفر",
      "تقليل الفاتورة",
      "اقلل الفاتورة",
      "أقلل الفاتورة",
      "استهلاك اقل",
    ],
    // a water tank on the roof
    tank: [
      "water tank",
      "tank",
      "roof tank",
      "clean the tank",
      "storage tank",
      "tanka avê",
      "tank",
      "tanka",
      "tanki aw",
      "tanki",
      "tank",
      "تانکی ئاو",
      "تانکی",
      "تانکەکە",
      "مەخزەن",
      "خزان",
      "الخزان",
      "تانكي",
      "التانكي",
      "خزان الماء",
    ],
    // a typed answer to a step-by-step question
    yes: [
      "yes",
      "yeah",
      "yep",
      "yup",
      "sure",
      "they do",
      "it is",
      "it did",
      "bale",
      "bali",
      "baly",
      "ballê",
      "erê",
      "ere",
      "belê",
      "bele",
      "بەڵێ",
      "بەلێ",
      "ئا",
      "ئەرێ",
      "نعم",
      "اي",
      "إي",
      "ايه",
      "أيوه",
      "اكيد",
      "صح",
    ],
    no: [
      "no",
      "nope",
      "nah",
      "not",
      "they don't",
      "it isn't",
      "it didn't",
      "naxer",
      "naxêr",
      "na",
      "ne",
      "nexêr",
      "نەخێر",
      "نا",
      "نە",
      "لا",
      "كلا",
      "مو",
      "ماكو",
    ],
    // the main switch keeps going off
    breaker: [
      "breaker",
      "tripping",
      "trips",
      "tripped",
      "trip switch",
      "fuse",
      "fuses",
      "mcb",
      "rcd",
      "main switch",
      "switch keeps",
      "keeps switching off",
      "keeps going off",
      "sîgorte",
      "sigorte",
      "şalter",
      "salter",
      "dikeve",
      "diqete",
      "qate",
      "qatia",
      "qati",
      "fiuz",
      "fyuz",
      "swich",
      "swech",
      "dapart",
      "daparet",
      "قاتع",
      "قاتیع",
      "فیوز",
      "سویچ",
      "دەپەڕێت",
      "دەپەڕی",
      "دادەکەوێت",
      "القاطع",
      "قاطع",
      "فيوز",
      "الفيوز",
      "الجوزة",
      "يفصل",
      "يطفي القاطع",
      "ينزل القاطع",
    ],
    // lights flicker, voltage up and down
    flicker: [
      "لەرز",
      "گڵۆپەکان کز",
      "dibiriqin",
      "دەلەرزن",
      "flicker",
      "flickering",
      "flickers",
      "dim",
      "dimming",
      "voltage",
      "jumping",
      "up and down",
      "low voltage",
      "high voltage",
      "weak power",
      "weak electricity",
      "surge",
      "surges",
      "voltaj",
      "volt",
      "dibiriqe",
      "biriqîn",
      "lerz",
      "kêm û zêde",
      "kem u zede",
      "foltya",
      "foltiya",
      "kam w zor",
      "kam u zor",
      "larzin",
      "kz",
      "فۆڵتیە",
      "فۆلتیە",
      "فولتیە",
      "کەم و زۆر",
      "لەرزین",
      "دەلەرزێت",
      "کزە",
      "فولتية",
      "الفولتية",
      "ضعيفة",
      "تذبذب",
      "متذبذبة",
      "يرمش",
      "ترمش",
      "تطفي وتشتغل",
      "تقطع وترجع",
      "نازلة",
    ],
    // weak water
    weak: [
      "upstairs",
      "second floor",
      "top floor",
      "doesn't reach",
      "doesnt reach",
      "won't go up",
      "wont go up",
      "سەرەوە",
      "نهۆمی دووەم",
      "سەرناکەوێت",
      "نایەتە سەرەوە",
      "jor",
      "qata duyem",
      "nagihîje jor",
      "ما يصعد",
      "ما يوصل",
      "الطابق الثاني",
      "فوق",
      "weak",
      "pressure",
      "low pressure",
      "barely",
      "trickle",
      "trickling",
      "slow",
      "drip",
      "dripping",
      "not enough",
      "qels",
      "zext",
      "hindik",
      "hêdî",
      "hedi",
      "lawaz",
      "fishar",
      "kam",
      "kama",
      "لاواز",
      "فشار",
      "ئاوەکە کەمە",
      "کەم دێت",
      "هێواش",
      "ضعيف",
      "ضغط",
      "قليل",
      "شوية",
      "ينقط",
      "بطيء",
    ],
    // water that looks, smells or tastes wrong
    dirty: [
      "milky",
      "white water",
      "foamy",
      "bubbles",
      "سپییە",
      "وەک شیر",
      "کەف",
      "spî",
      "wek şîr",
      "ابيض",
      "مثل الحليب",
      "حليب",
      "dirty",
      "smell",
      "smells",
      "smelly",
      "stinks",
      "colour",
      "color",
      "coloured",
      "colored",
      "brown",
      "yellow",
      "cloudy",
      "muddy",
      "rust",
      "rusty",
      "taste",
      "tastes",
      "salty",
      "sewage in",
      "qirêj",
      "qirej",
      "bêhn",
      "behn",
      "şêlo",
      "selo",
      "reng",
      "tam",
      "pis",
      "bon",
      "bon dakat",
      "lixn",
      "lîxn",
      "rang",
      "پیس",
      "بۆن",
      "بۆنی",
      "ڕەنگ",
      "ڕەنگی",
      "لیخن",
      "تەڵخ",
      "تامی",
      "وسخ",
      "وسخة",
      "متسخ",
      "ملوث",
      "ملوثة",
      "رائحة",
      "ريحة",
      "لونه",
      "لونها",
      "عكر",
      "مصفر",
      "طين",
      "طعم",
      "مالح",
    ],
    // when will it come back
    eta: [
      "when",
      "how long",
      "what time",
      "back on",
      "come back",
      "coming back",
      "until when",
      "till when",
      "be back",
      "return",
      "kengî",
      "kengi",
      "kenge",
      "heta kengê",
      "heta kenge",
      "vegere",
      "vedigere",
      "çiqas dem",
      "kay",
      "kai",
      "kaengê",
      "ta kay",
      "takay",
      "detawa",
      "datawa",
      "dethewe",
      "کەی",
      "کەنگێ",
      "کەنگی",
      "تاکەی",
      "تا کەی",
      "دێتەوە",
      "دەگەڕێتەوە",
      "چەند کاتژمێر",
      "شوكت",
      "متى",
      "امتى",
      "إمتى",
      "الى متى",
      "لمتى",
      "ترجع",
      "راح ترجع",
      "تجي",
      "كم ساعة",
    ],
    // why
    why: [
      "why",
      "how come",
      "reason",
      "çima",
      "cima",
      "çi sedem",
      "bochi",
      "bo chi",
      "boche",
      "بۆچی",
      "بۆ چی",
      "هۆکار",
      "ليش",
      "لماذا",
      "ليه",
      "شنو السبب",
      "السبب",
    ],
    // is it back now
    fixed: [
      "fixed",
      "is it back",
      "back yet",
      "working now",
      "came back",
      "come back yet",
      "hat çêkirin",
      "vegeriya",
      "hat",
      "chak bwa",
      "chakbwa",
      "hatawa",
      "hatotawa",
      "garrayawa",
      "چاک بوو",
      "چاکبوو",
      "هاتەوە",
      "گەڕایەوە",
      "رجعت",
      "رجع",
      "انصلحت",
      "تصلحت",
    ],
    // "can I talk to a person?"
    human: [
      "complain",
      "complaint",
      "make a complaint",
      "سکاڵا",
      "شکایەت",
      "gilî",
      "gazinc",
      "gazin",
      "اشتكي",
      "أشتكي",
      "شكوى",
      "شكوة",
      "human",
      "real person",
      "a person",
      "agent",
      "staff",
      "employee",
      "operator",
      "talk to someone",
      "speak to someone",
      "talk to a",
      "speak to a",
      "customer service",
      "someone from the team",
      "the team",
      "call me",
      "talk to",
      "speak to",
      "mirov",
      "mirovek",
      "kesek",
      "karmend",
      "bi kesekî re",
      "bi mirovekî re",
      "bi tîmê re",
      "kasek",
      "karmand",
      "qsa bkam",
      "qsakrdn",
      "qse bkem",
      "کەسێک",
      "مرۆڤ",
      "کارمەند",
      "قسە بکەم",
      "قسەکردن لەگەڵ",
      "لەگەڵ تیم",
      "کەسێکی ڕاستەقینە",
      "شخص",
      "موظف",
      "انسان",
      "إنسان",
      "أكلم",
      "اكلم",
      "احكي مع",
      "التحدث مع",
      "خدمة العملاء",
      "اريد احد",
      "أريد أحد",
    ],
    // "it's been three days"
    long: [
      "since last night",
      "since this morning",
      "since morning",
      "since the morning",
      "still out",
      "still off",
      "still no",
      "hîn tune",
      "hin tune",
      "هێشتا نییە",
      "بعدها ماكو",
      "لسه",
      "من البارحة",
      "من الصبح",
      "days",
      "for days",
      "two days",
      "three days",
      "a week",
      "weeks",
      "since yesterday",
      "all day",
      "all night",
      "for hours",
      "still",
      "again and again",
      "every day",
      "rojan",
      "çend roj",
      "cend roj",
      "du roj",
      "sê roj",
      "se roj",
      "hefte",
      "ji duh ve",
      "hemû roj",
      "hîn jî",
      "hin ji",
      "chand rozha",
      "chand roja",
      "du roja",
      "se roja",
      "la duenewa",
      "hafta",
      "hashta",
      "ڕۆژە",
      "چەند ڕۆژ",
      "دوو ڕۆژ",
      "سێ ڕۆژ",
      "هەفتەیەک",
      "هەفتە",
      "لە دوێنێوە",
      "هەموو ڕۆژێک",
      "هێشتا",
      "أيام",
      "ايام",
      "يومين",
      "ثلاث أيام",
      "ثلاثة أيام",
      "أسبوع",
      "اسبوع",
      "من امس",
      "من أمس",
      "لحد الآن",
      "لحد هسة",
      "كل يوم",
      "بعده",
    ],
    // "that didn't help"
    frustrated: [
      "not helpful",
      "doesn't help",
      "doesnt help",
      "didn't help",
      "didnt help",
      "no help",
      "you don't understand",
      "you dont understand",
      "not what i asked",
      "wrong answer",
      "that's wrong",
      "thats wrong",
      "makes no sense",
      "useless",
      "pointless",
      "waste of time",
      "fêm nakî",
      "fem naki",
      "alîkarî nake",
      "alikari nake",
      "bêkêr",
      "beker",
      "ne rast e",
      "tenagay",
      "tênagay",
      "hich sudi niya",
      "besuda",
      "تێناگەیت",
      "تێنەگەیشتی",
      "یارمەتیم نادات",
      "هیچ سوودی نییە",
      "بێسوودە",
      "هەڵەیە",
      "ما فهمت",
      "ما تفهم",
      "مو مفهوم",
      "ما ساعدتني",
      "غير مفيد",
      "خطأ",
      "مو هذا",
    ],
    insult: [
      "stupid",
      "dumb",
      "idiot",
      "useless",
      "bad bot",
      "you suck",
      "trash",
      "ehmeq",
      "bêkêr",
      "beker",
      "gamzha",
      "gemzhe",
      "kar",
      "bekalk",
      "bekelk",
      "hich nazanit",
      "hichi nazanit",
      "گەمژە",
      "کەر",
      "بێکەڵک",
      "هیچ نازانیت",
      "غبي",
      "اهبل",
      "ما تفهم",
      "فاشل",
    ],
    yesno: [
      "ok",
      "okay",
      "k",
      "yes",
      "no",
      "yeah",
      "nope",
      "fine",
      "alright",
      "cool",
      "nice",
      "good",
      "erê",
      "ere",
      "na",
      "baş e",
      "bas e",
      "temam",
      "bale",
      "bali",
      "baly",
      "ballê",
      "naxer",
      "na",
      "bash",
      "basha",
      "temam",
      "tamam",
      "bashe",
      "zor bash",
      "بەڵێ",
      "نەخێر",
      "باشە",
      "تەواو",
      "زۆر باشە",
      "نعم",
      "لا",
      "تمام",
      "زين",
      "حلو",
      "اوكي",
      "طيب",
    ],
    planned: [
      "planned",
      "plan",
      "schedule",
      "scheduled",
      "maintenance",
      "announced",
      "announcement",
      "programmed",
      "plankirî",
      "plankiri",
      "lênêrîn",
      "lenerin",
      "ragihandin",
      "bername",
      "پلان",
      "پلانکراو",
      "خشتە",
      "چاککردنەوە",
      "چاکردنەوە",
      "ڕاگەیەندراو",
      "ڕاگەیاندن",
      "بەرنامە",
      "مجدول",
      "مجدولة",
      "جدول",
      "صيانة",
      "اعلان",
      "إعلان",
      "مبرمج",
      "مبرمجة",
      "قطع مبرمج",
    ],
    runaki: [
      "runaki",
      "rounaki",
      "runaky",
      "roonaki",
      "ronaki",
      "runakî",
      "24 hour",
      "24h",
      "24/7",
      "24 hours",
      "24 saet",
      "24 seat",
      "ڕووناکی",
      "روناکی",
      "ڕوناکی",
      "رووناکی",
      "٢٤ کاتژمێر",
      "24 کاتژمێر",
      "روناكي",
      "رووناكي",
      "24 ساعة",
      "٢٤ ساعة",
      "24 ساعه",
    ],
    generator: [
      "generator",
      "generators",
      "ampere",
      "amps",
      "amp",
      "moelîde",
      "moelide",
      "mulîde",
      "mulide",
      "molida",
      "mewlîde",
      "jenerator",
      "ampêr",
      "amper",
      "مۆلیدە",
      "مولیدە",
      "مۆلیده",
      "ئەمپێر",
      "ئەمپیر",
      "مولدة",
      "مولده",
      "المولدة",
      "المولدات",
      "امبير",
      "أمبير",
      "الامبير",
    ],
    report: [
      "raport",
      "raporrt",
      "ragayandin",
      "rabgayanm",
      "rabgayanin",
      "shkat",
      "skala",
      "bnerm",
      "report",
      "reporting",
      "complain",
      "complaint",
      "tell",
      "submit",
      "send",
      "ragihînim",
      "ragihinim",
      "ragihîne",
      "rapor",
      "gilî",
      "gili",
      "bişînim",
      "ڕاپۆرت",
      "راپۆرت",
      "ڕابگەیەنم",
      "رابگەیەنم",
      "سکاڵا",
      "شکات",
      "بنێرم",
      "ڕاگەیاندن",
      "ابلغ",
      "أبلغ",
      "بلاغ",
      "ابلاغ",
      "إبلاغ",
      "اشتكي",
      "شكوى",
      "ارسل",
      "أرسل",
    ],
    quality: [
      "dirty",
      "drink",
      "drinking",
      "safe",
      "smell",
      "smells",
      "colour",
      "color",
      "brown",
      "yellow water",
      "qirêj",
      "qirej",
      "vexwarin",
      "vexwim",
      "bêhn",
      "behn",
      "پیس",
      "خواردنەوە",
      "بخۆمەوە",
      "بۆن",
      "ڕەنگ",
      "لیخن",
      "وسخ",
      "متسخ",
      "ملوث",
      "ملوثة",
      "شرب",
      "اشرب",
      "أشرب",
      "رائحة",
      "ريحة",
      "لونه",
      "اللون",
      "عكر",
    ],
    about: [
      "who are you",
      "who runs",
      "who made",
      "who built",
      "who owns",
      "who is behind",
      "official",
      "government",
      "privacy",
      "data",
      "trust",
      "source",
      "sources",
      "about",
      "tu kî",
      "kî ne",
      "fermî",
      "hikûmet",
      "hikumet",
      "nepenî",
      "تۆ کێیت",
      "کێن",
      "فەرمی",
      "حکومی",
      "حکومەت",
      "تایبەتمەندی",
      "سەرچاوە",
      "من انت",
      "من أنت",
      "من انتم",
      "رسمي",
      "حكومي",
      "الحكومة",
      "خصوصية",
      "مصدر",
    ],
    help: [
      "chi dakait",
      "chi dakay",
      "chit pe dakre",
      "chi datwanit",
      "yarmati",
      "yarmatim bda",
      "how to use",
      "guide",
      "menu",
      "help",
      "what can you do",
      "how does this work",
      "options",
      "alîkarî",
      "alikari",
      "çi dikarî",
      "ci dikari",
      "یارمەتی",
      "چی دەتوانیت",
      "چی دەکەیت",
      "مساعدة",
      "ساعدني",
      "ماذا تستطيع",
      "شنو تكدر",
    ],
    greet: [
      "good evening",
      "good afternoon",
      "ڕۆژباش",
      "ڕۆژ باش",
      "بەیانی باش",
      "ئێوارە باش",
      "rojbaş",
      "roj baş",
      "êvar baş",
      "evar bas",
      "مساء الخير",
      "صباح النور",
      "slaaw",
      "salaw",
      "slav",
      "sllaw",
      "bayani bash",
      "bayanit bash",
      "ewara bash",
      "ewarat bash",
      "rozh bash",
      "rozhbash",
      "hala",
      "halaw",
      "yo",
      "good afternoon",
      "salam alaykum",
      "salamu alaykum",
      "assalamu alaikum",
      "السلام عليكم",
      "هلو",
      "هلاو",
      "hi",
      "hello",
      "hey",
      "good morning",
      "good evening",
      "salam",
      "salaam",
      "silav",
      "slav",
      "slaw",
      "roj baş",
      "rojbas",
      "êvar baş",
      "merheba",
      "merhaba",
      "سڵاو",
      "سلاو",
      "بەیانی باش",
      "ئێوارە باش",
      "چۆنی",
      "مرحبا",
      "السلام",
      "سلام",
      "اهلا",
      "أهلا",
      "هلا",
      "صباح الخير",
      "مساء الخير",
      "شلونك",
    ],
    track: [
      "my request",
      "request status",
      "status of my request",
      "check my request",
      "track my request",
      "daxwaza min",
      "rewşa daxwazê",
      "dawakariyakam",
      "dawakariakam",
      "داواکارییەکەم",
      "دۆخی داواکاری",
      "ژمارەی داواکاری",
      "طلبي",
      "حالة الطلب",
      "رقم الطلب",
      "متابعة الطلب",
      "تابع طلبي",
    ],
    alerts: [
      "alert",
      "alerts",
      "notify",
      "notification",
      "notifications",
      "let me know",
      "tell me when",
      "agadar",
      "agadarkrdnawa",
      "agadarm bkarawa",
      "hişyarî",
      "hisyari",
      "agahdarî",
      "agahdari",
      "ئاگادارکردنەوە",
      "ئاگادارم بکەرەوە",
      "ئاگادار",
      "تنبيه",
      "تنبيهات",
      "اشعار",
      "إشعار",
      "اشعارات",
      "نبهني",
      "خبرني",
    ],
    photo: [
      "photo",
      "photos",
      "picture",
      "pic",
      "image",
      "camera",
      "wene",
      "wêne",
      "wena",
      "wenay",
      "وێنە",
      "وێنەیەک",
      "صورة",
      "صوره",
      "صور",
      "تصوير",
    ],
    thanks: [
      "spas",
      "zor spas",
      "zor supas",
      "supas",
      "dastxosh",
      "dast xosh",
      "dastxoshi",
      "mamnun",
      "mamnunm",
      "sag bit",
      "gyan",
      "طيب",
      "thank u",
      "ty",
      "tnx",
      "thanks",
      "thank you",
      "thx",
      "cheers",
      "great",
      "ok thanks",
      "spas",
      "supas",
      "sipas",
      "dest xweş",
      "destxweş",
      "mamnun",
      "سوپاس",
      "مەمنوون",
      "ممنون",
      "دەستخۆش",
      "زۆر سوپاس",
      "شكرا",
      "شكراً",
      "مشكور",
      "تسلم",
      "يعطيك العافية",
    ],
  };

  // Words that point to a language. Letters do most of the work; these
  // settle short or ambiguous questions.
  const LANG_WORDS = {
    en: [
      "tips",
      "night",
      "light",
      "nights",
      "lights",
      "tip",
      "trip",
      "week",
      "day",
      "hour",
      "hours",
      "month",
      "the",
      "is",
      "are",
      "there",
      "what",
      "how",
      "where",
      "in",
      "my",
      "do",
      "does",
      "i",
      "want",
      "need",
      "to",
      "a",
      "an",
      "we",
      "our",
      "us",
      "please",
      "will",
      "when",
      "why",
      "not",
      "no",
      "yes",
      "since",
      "for",
      "of",
      "with",
      "from",
      "about",
      "could",
      "would",
      "should",
      "talk",
      "speak",
      "person",
      "street",
      "house",
      "home",
      "still",
      "again",
      "been",
      "was",
      "were",
      "its",
      "it's",
      "this",
      "that",
      "here",
      "help",
      "someone",
      "be",
      "back",
      "come",
      "power",
      "water",
      "much",
      "any",
      "today",
      "now",
      "have",
      "has",
      "can",
      "you",
      "it",
      "on",
      "off",
      "out",
      "and",
      "hello",
      "hi",
      "thanks",
      "which",
      "bill",
      "report",
    ],
    kmr: [
      "ava",
      "avê",
      "me",
      "mala",
      "kolan",
      "kolanê",
      "ketiye",
      "dikeve",
      "vedigere",
      "kengî",
      "qels",
      "qirêj",
      "bêhn",
      "dide",
      "pir",
      "her",
      "dem",
      "li",
      "heye",
      "hene",
      "tune",
      "çi",
      "çawa",
      "ku",
      "kehreba",
      "av",
      "min",
      "ez",
      "tu",
      "niha",
      "çiqas",
      "ye",
      "îro",
      "çend",
      "taxa",
      "bajêr",
      "silav",
      "spas",
      "kîjan",
      "dikarim",
      "bikim",
      "ragihînim",
      "bi",
      "ji",
      "û",
      "jî",
      "nîne",
      "karaba",
      "kareba",
      "haya",
      "niya",
      "la",
      "chon",
      "chand",
      "kwe",
      "slaw",
      "supas",
      "awi",
      "aw",
      "bo",
    ],
    ckb: [
      "لە",
      "لە",
      "هەیە",
      "نییە",
      "چۆن",
      "کوێ",
      "چەند",
      "کارەبا",
      "ئاو",
      "من",
      "ئێستا",
      "ئەمڕۆ",
      "گەڕەک",
      "گەڕەکی",
      "بۆ",
      "چی",
      "دەتوانم",
      "بکەم",
      "و",
      "یان",
      "ئایا",
      "سڵاو",
      "سوپاس",
      "ماڵ",
      "ماڵەکەمان",
    ],
    ar: [
      "هل",
      "في",
      "ما",
      "كيف",
      "أين",
      "اين",
      "وين",
      "عندي",
      "الكهرباء",
      "الماء",
      "كم",
      "اليوم",
      "الآن",
      "هناك",
      "يوجد",
      "من",
      "إلى",
      "على",
      "عن",
      "شنو",
      "اكو",
      "ماكو",
      "شلون",
      "مرحبا",
      "شكرا",
      "حي",
      "منطقة",
      "انا",
      "أنا",
    ],
  };

  /* ------------------------------------------------------------------ *
   * Replies. {placeholders} are filled in by answer().
   * ------------------------------------------------------------------ */
  const R = {
    greet: {
      en: "Hi! Tell me your neighbourhood and I'll tell you what people are reporting there. You can also ask about your bill, planned cuts or the news.",
      ckb: "سڵاو! ناوی گەڕەکەکەت بڵێ، پێت دەڵێم خەڵک چی لەوێ ڕادەگەیەنن. دەتوانیت دەربارەی پسوولە، بڕانی پلانکراو یان هەواڵەکانیش بپرسیت.",
      kmr: "Silav! Navê taxa xwe bibêje, ez ê ji te re bibêjim mirov li wir çi radigihînin. Tu dikarî li ser fatûreyê, qutbûnên plankirî an nûçeyan jî bipirsî.",
      ar: "أهلًا! قل لي اسم حيّك وأخبرك بما يبلّغ عنه الناس هناك. يمكنك أيضًا أن تسأل عن الفاتورة أو الانقطاعات المجدولة أو الأخبار.",
      ckbl: "Slaw! Nawi garakakat bley, pet dalem xalk chi lawe radagayann. Datwanit darbaray pswla, brrani plankraw yan hawalakanish bprsit.",
    },
    thanks: {
      en: "You're welcome! If anything changes on your street, a quick report helps your neighbours.",
      ckb: "شایانی نییە! ئەگەر شتێک لە شەقامەکەت گۆڕا، ڕاپۆرتێکی خێرا یارمەتی دراوسێکانت دەدات.",
      kmr: "Ser seran! Heke li kolana te tiştek biguhere, raporek bilez alîkariya cîranên te dike.",
      ar: "العفو! إذا تغيّر شيء في شارعك، بلاغ سريع يساعد جيرانك.",
      ckbl: "Shayani niya! Agar shtek la shaqamakat gora, raporteki xera yarmati drawsekanit dadat.",
    },
    help: {
      en: "I can help with:<ul><li>whether power or water is out in a neighbourhood</li><li>where problems are reported right now</li><li>cuts the team has announced</li><li>the latest news</li><li>Runaki coverage and what your bill would be</li><li>how to report, or what to do if it's only your house</li><li>how to pay, privacy, and what the colours mean</li></ul>",
      ckb: "دەتوانم یارمەتیت بدەم لە:<ul><li>ئایا لە گەڕەکێکدا کارەبا یان ئاو بڕاوە</li><li>لە ئێستادا لە کوێ کێشە ڕاگەیەندراوە</li><li>ئەو بڕانانەی تیمەکە ڕایگەیاندوون</li><li>دوایین هەواڵەکان</li><li>ڕووناکی و پسوولەکەت چەند دەبێت</li><li>چۆن ڕاپۆرت بدەیت، یان چی بکەیت ئەگەر تەنها ماڵەکەت بێت</li><li>پارەدان، تایبەتمەندی و واتای ڕەنگەکان</li></ul>",
      kmr: "Ez dikarim alîkariyê bikim di van de:<ul><li>ka li taxekê kehreba an av qut bûye</li><li>niha li ku pirsgirêk tên ragihandin</li><li>qutbûnên ku tîm ragihandine</li><li>nûçeyên dawî</li><li>Runakî û fatûreya te dê çiqas be</li><li>çawa rapor bidî, an çi bikî heke tenê mala te be</li><li>dayîn, nepenî û wateya rengan</li></ul>",
      ar: "يمكنني المساعدة في:<ul><li>إن كانت الكهرباء أو الماء مقطوعة في حيّ ما</li><li>أين يبلّغ الناس عن مشاكل الآن</li><li>الانقطاعات التي أعلنها الفريق</li><li>آخر الأخبار</li><li>روناكي وكم ستكون فاتورتك</li><li>كيف تبلّغ، أو ماذا تفعل إن كانت المشكلة في بيتك فقط</li><li>الدفع والخصوصية ومعنى الألوان</li></ul>",
    },
    unknown: {
      en: "Sorry, I didn't catch that. Try something like:",
      ckb: "ببورە، تێنەگەیشتم. شتێکی وەک ئەمانە تاقی بکەرەوە:",
      kmr: "Bibore, min fam nekir. Tiştekî wek van biceribîne:",
      ar: "عذرًا، لم أفهم. جرّب شيئًا مثل:",
      ckbl: "Bbura, tenagayshtm. Shteki wak amana taqi bkarawa:",
    },
    whichArea: {
      en: "Which neighbourhood? For example: Ankawa, Brayati, Kasnazan, Iskan.",
      ckb: "کام گەڕەک؟ بۆ نموونە: عەنکاوە، برایەتی، کەسنەزان، ئیسکان.",
      kmr: "Kîjan tax? Mînak: Enkawa, Birayetî, Kesnezan, Îskan.",
      ar: "أي حيّ؟ مثلًا: عنكاوا، برايتي، كسنزان، اسكان.",
    },
    areaHead: {
      en: "<b>{area}</b>, last 24 hours:",
      ckb: "<b>{area}</b>، لە ٢٤ کاتژمێری ڕابردوودا:",
      kmr: "<b>{area}</b>, di 24 saetên dawî de:",
      ar: "<b>{area}</b>، خلال آخر ٢٤ ساعة:",
    },
    nothingHere: {
      en: "nobody has reported a problem.",
      ckb: "کەس کێشەیەکی ڕانەگەیاندووە.",
      kmr: "kesî pirsgirêkek ranegihandiye.",
      ar: "لم يبلّغ أحد عن مشكلة.",
    },
    noneMeansUnknown: {
      en: "No reports doesn't always mean everything is fine. Maybe nobody has posted yet.",
      ckb: "نەبوونی ڕاپۆرت هەمیشە مانای ئەوە نییە کە هەموو شتێک باشە. لەوانەیە هێشتا کەس نەینووسیبێت.",
      kmr: "Tunebûna raporan her tim nayê wê wateyê ku her tişt baş e. Dibe ku hê kesî nenivîsandibe.",
      ar: "عدم وجود بلاغات لا يعني دائمًا أن كل شيء بخير. ربما لم يكتب أحد بعد.",
    },
    runakiLine: {
      en: "Runaki: {status}.",
      ckb: "ڕووناکی: {status}.",
      kmr: "Runakî: {status}.",
      ar: "روناكي: {status}.",
    },
    openArea: {
      en: "Open {area}",
      ckb: "{area} بکەرەوە",
      kmr: "{area} veke",
      ar: "افتح صفحة {area}",
    },
    reportIn: {
      en: "Report a problem there",
      ckb: "کێشەیەک لەوێ ڕابگەیەنە",
      kmr: "Li wir pirsgirêkekê ragihîne",
      ar: "بلّغ عن مشكلة هناك",
    },
    listHead: {
      en: "Where people are reporting {what} right now:",
      ckb: "ئەو شوێنانەی خەڵک لە ئێستادا {what} ڕادەگەیەنن:",
      kmr: "Cihên ku mirov niha {what} radigihînin:",
      ar: "الأماكن التي يبلّغ فيها الناس الآن عن {what}:",
    },
    whatPower: { en: "power problems", ckb: "کێشەی کارەبا", kmr: "pirsgirêkên kehrebê", ar: "مشاكل الكهرباء" },
    whatWater: { en: "water problems", ckb: "کێشەی ئاو", kmr: "pirsgirêkên avê", ar: "مشاكل الماء" },
    whatBoth: {
      en: "power or water problems",
      ckb: "کێشەی کارەبا یان ئاو",
      kmr: "pirsgirêkên kehrebê an avê",
      ar: "مشاكل الكهرباء أو الماء",
    },
    hello: { en: "Hello!", ckb: "سڵاو!", kmr: "Silav!", ar: "أهلًا!" },
    howareyou: {
      en: "Good, thanks! Which neighbourhood are you in? I'll check the power and water there.",
      ckb: "باشم، سوپاس! لە کام گەڕەکیت؟ کارەبا و ئاوی ئەوێت بۆ دەپشکنم.",
      kmr: "Baş im, spas! Tu li kîjan taxê yî? Ez ê li kehreba û ava wir binêrim.",
      ar: "بخير، شكرًا! في أي حيّ أنت؟ أشوف لك الكهرباء والماء هناك.",
      ckbl: "Bashm, supas! La kam garaki? Karaba w awi awet bo dapshknm.",
    },
    bye: {
      en: "Take care! Come back whenever the power or water plays up.",
      ckb: "خوات لەگەڵ! هەر کاتێک کارەبا یان ئاو کێشەی هەبوو، وەرەوە.",
      kmr: "Bi xatirê te! Kengî kehreba an av pirsgirêk derxist, dîsa were.",
      ar: "مع السلامة! ارجع متى ما صار عندك مشكلة بالكهرباء أو الماء.",
      ckbl: "Xwat lagal! Har katek karaba yan aw keshay hebu, warawa.",
    },
    whoami: {
      en: "I'm the helper built into this site: not a person, not the government, and not an AI service. Everything I say comes from what's here, on your phone. I go by what's here: neighbours' reports, planned cuts, Runaki, prices and the news. Write in Kurdish, Arabic or English and I'll answer the same way.",
      ckb: "من یاریدەدەری ئەم ماڵپەڕەم. مرۆڤ نیم و حکومەتیش نیم. پشت بەوە دەبەستم کە لێرەیە: ڕاپۆرتی دراوسێکان، بڕانە پلانکراوەکان، ڕووناکی، نرخەکان و هەواڵەکان. بە کوردی، عەرەبی یان ئینگلیزی بنووسە، بە هەمان زمان وەڵامت دەدەمەوە.",
      kmr: "Ez alîkarê vê malperê me. Ne mirov im, ne jî hikûmet. Ez bi tiştên li vir dixebitim: raporên cîranan, qutbûnên plankirî, Runakî, biha û nûçe. Bi kurdî, erebî an îngilîzî binivîse, ez ê bi heman zimanî bersiv bidim.",
      ar: "أنا مساعد هذا الموقع. لست إنسانًا ولست جهة حكومية. أعتمد على ما هو موجود هنا: بلاغات الجيران، الانقطاعات المجدولة، روناكي، الأسعار والأخبار. اكتب بالكردية أو العربية أو الإنجليزية وأجيبك بنفس اللغة.",
      ckbl: "Min yaridaderi am malparam. Mrov nim w hkumatish nim. Pisht bawa dabastm ka leraya: raporti drawsekan, brrana plankrawakan, Runaki, nrxakan w hawalakan. Ba kurdi, arabi yan inglizi bnusa, ba haman zman walamit dadamawa.",
    },
    newsHead: {
      en: "The latest about power and water in Erbil:",
      ckb: "دوایین هەواڵەکانی کارەبا و ئاوی هەولێر:",
      kmr: "Nûçeyên dawî li ser kehreba û ava Hewlêrê:",
      ar: "آخر أخبار الكهرباء والماء في أربيل:",
    },
    newsMore: {
      en: "All news on the Runaki page",
      ckb: "هەموو هەواڵەکان لە لاپەڕەی ڕووناکی",
      kmr: "Hemû nûçe li rûpela Runakî",
      ar: "كل الأخبار في صفحة روناكي",
    },
    private: {
      en: "If it's only your house, or two or three houses, the cause is usually a fuse, the meter or the nearest pole, not the whole neighbourhood. On the report form choose “Only my house” and leave your phone number and the nearest landmark. It goes straight into the team's inbox, never on the map, and someone calls you back to agree a time. You get a reference so you can check on it later.",
      ckb: "ئەگەر تەنها ماڵەکەی تۆ یان دوو سێ ماڵ بێت، هۆکارەکەی زۆرجار فیوز، مەتر یان نزیکترین ستوونە، نەک هەموو گەڕەکەکە. لە فۆرمی ڕاپۆرتدا «تەنها ماڵەکەی من» هەڵبژێرە و ژمارەی مۆبایل و نزیکترین شوێنی ناسراو بنووسە. ڕاستەوخۆ دەچێتە سندوقی تیمەکە، هەرگیز لەسەر نەخشە نا، و کەسێک پەیوەندیت پێوە دەکات بۆ دانانی کاتێک. ژمارەیەکی داواکاریت پێدەدرێت بۆ ئەوەی دواتر سەیری بکەیت.",
      kmr: "Heke tenê mala te an du sê mal bin, sedem bi gelemperî fîtîl, saet an stûna herî nêzîk e, ne hemû tax. Di forma raporê de «Tenê mala min» hilbijêre û hejmara telefonê û cihê naskirî binivîse. Ew rasterast diçe qutiya tîmê, qet li ser nexşeyê na, û yek dê telefonî te bike da ku demekê saz bike. Hejmareke daxwazê tê dayîn da ku paşê lê binêrî.",
      ar: "إذا كانت المشكلة في بيتك فقط أو بيتين أو ثلاثة، فالسبب عادةً فيوز أو العدّاد أو أقرب عمود، لا الحيّ كله. في نموذج البلاغ اختر «بيتي فقط» واترك رقم هاتفك وأقرب معلم. يصل الطلب مباشرة إلى صندوق الفريق، ولا يظهر على الخريطة، ويتصل بك أحدهم لتحديد موعد. تحصل على رقم طلب لتتابعه لاحقًا.",
    },
    track: {
      en: "To check on a private request, open the report page and use “Check on a private request” at the bottom. You need the reference (like EU-ABC123) and the last four digits of your phone number. Requests sent from this phone are listed there already.",
      ckb: "بۆ سەیرکردنی داواکارییەکی تایبەت، پەڕەی ڕاپۆرت بکەرەوە و لە خوارەوە «سەیری داواکارییەکی تایبەت بکە» بەکاربهێنە. ژمارەی داواکاری (وەک EU-ABC123) و چوار ژمارەی کۆتایی مۆبایلەکەتت پێویستە. ئەو داواکارییانەی لەم مۆبایلەوە ناردوون پێشتر لەوێ دانراون.",
      kmr: "Ji bo ku li daxwazeke taybet binêrî, rûpela raporê veke û li jêr «Li daxwazeke taybet binêre» bi kar bîne. Hejmara daxwazê (wek EU-ABC123) û çar reqemên dawî yên telefona te hewce ne. Daxwazên ji vê telefonê hatine şandin jixwe li wir in.",
      ar: "لمتابعة طلب خاص، افتح صفحة البلاغ واستخدم «تابع طلبًا خاصًا» في الأسفل. تحتاج رقم الطلب (مثل EU-ABC123) وآخر أربعة أرقام من هاتفك. الطلبات المرسلة من هذا الهاتف تظهر هناك مسبقًا.",
    },
    trackLink: {
      en: "Check on my request",
      ckb: "سەیری داواکارییەکەم بکە",
      kmr: "Li daxwaza min binêre",
      ar: "تابع طلبي",
    },
    alerts: {
      en: "You can get an alert on your phone when the team announces a planned cut in your neighbourhood, or when no power or no water there is confirmed. Open your neighbourhood's page and tap “Get alerts”. On iPhone, add the site to your Home Screen first.",
      ckb: "دەتوانیت ئاگادارکردنەوە لەسەر مۆبایلەکەت وەربگریت کاتێک تیمەکە بڕانێکی پلانکراو لە گەڕەکەکەت ڕادەگەیەنێت، یان کاتێک نەبوونی کارەبا یان ئاو لەوێ پشتڕاست دەکرێتەوە. پەڕەی گەڕەکەکەت بکەرەوە و «ئاگادارکردنەوە وەربگرە» دابگرە. لە ئایفۆن سەرەتا ماڵپەڕەکە بخەرە سەر شاشەی سەرەکی.",
      kmr: "Tu dikarî hişyariyekê li ser telefona xwe bistînî gava tîm qutbûneke plankirî li taxa te ragihîne, an gava nebûna kehrebê an avê li wir tê piştrastkirin. Rûpela taxa xwe veke û «Hişyariyan bistîne» bitikîne. Li ser iPhone, pêşî malperê li Ekrana Sereke zêde bike.",
      ar: "يمكنك تلقي تنبيه على هاتفك عندما يعلن الفريق انقطاعًا مجدولًا في حيّك، أو عندما يتأكد انقطاع الكهرباء أو الماء فيه. افتح صفحة حيّك واضغط «استلم تنبيهات». على آيفون، أضف الموقع إلى الشاشة الرئيسية أولًا.",
    },
    photo: {
      en: "Yes, you can add a photo to a public report, like a fallen cable or a burst pipe. The team checks every photo before anyone else sees it, and the hidden location data inside photos is removed. Please keep faces, house numbers and car plates out of the picture.",
      ckb: "بەڵێ، دەتوانیت وێنەیەک بۆ ڕاپۆرتێکی گشتی زیاد بکەیت، وەک وایەرێکی کەوتوو یان بۆرییەکی تەقیو. تیمەکە پێش ئەوەی کەسی تر بیبینێت هەموو وێنەیەک دەپشکنێت، و زانیاریی شوێنی شاراوە لەناو وێنەکەدا لادەبرێت. تکایە ڕوخسار، ژمارەی ماڵ و تابلۆی ئۆتۆمبێل مەخەرە ناو وێنەکەوە.",
      kmr: "Erê, tu dikarî wêneyekê li raporeke giştî zêde bikî, wek kabloyek ketî an boriyeke teqiyayî. Tîm berî ku kesek din bibîne her wêneyê kontrol dike, û daneyên cihê veşartî yên di wêneyê de tên rakirin. Ji kerema xwe rû, hejmara malê û plakaya otomobîlê nexe nav wêneyê.",
      ar: "نعم، يمكنك إضافة صورة إلى بلاغ عام، مثل كابل ساقط أو أنبوب منفجر. يراجع الفريق كل صورة قبل أن يراها أحد، وتُحذف بيانات الموقع المخفية داخل الصور. يُرجى عدم تصوير الوجوه وأرقام البيوت ولوحات السيارات.",
    },
    privateLink: {
      en: "Report for my house only",
      ckb: "ڕاپۆرت بۆ تەنها ماڵەکەم",
      kmr: "Rapor ji bo tenê mala min",
      ar: "بلاغ لبيتي فقط",
    },
    contact: {
      en: "You reach the team through the report form: choose “Only my house” or “My house and 2–3 others” and press send. The request goes into the team's inbox. They work {hours} and call or message you back.",
      ckb: "لە ڕێگەی فۆرمی ڕاپۆرتەوە دەگەیتە تیمەکە: «تەنها ماڵەکەی من» یان «ماڵەکەم و ٢–٣ ماڵی تر» هەڵبژێرە و بینێرە. داواکارییەکە دەچێتە سندوقی تیمەکە. {hours} کار دەکەن و پەیوەندیت پێوە دەکەن یان نامەت بۆ دەنێرن.",
      kmr: "Tu bi forma raporê digihîjî tîmê: «Tenê mala min» an «Mala min û 2–3 malên din» hilbijêre û bişîne. Daxwaz diçe qutiya tîmê. Ew {hours} dixebitin û telefon an peyamê didin te.",
      ar: "تصل إلى الفريق عبر نموذج البلاغ: اختر «بيتي فقط» أو «بيتي و٢–٣ بيوت أخرى» واضغط إرسال. يصل الطلب إلى صندوق الفريق. يعملون {hours} ويتصلون بك أو يراسلونك.",
    },
    contactPhone: {
      en: "You can also call {phone}.",
      ckb: "دەتوانیت پەیوەندیش بکەیت بە {phone}.",
      kmr: "Tu dikarî li {phone} jî bigerî.",
      ar: "يمكنك أيضًا الاتصال على {phone}.",
    },
    colours: {
      en: "On the map and the lists: <b>red</b> means at least two people say there's no power or no water; <b>amber</b> means other problems (weak voltage, low pressure…); a <b>grey ring</b> is a single report nobody has confirmed yet; <b>green</b> means people say it's back; <b>blue</b> is a cut the team announced in advance.",
      ckb: "لەسەر نەخشە و لیستەکان: <b>سوور</b> واتە لانیکەم دوو کەس دەڵێن کارەبا یان ئاو نییە؛ <b>پرتەقاڵی</b> واتە کێشەی تر (ڤۆڵتی لاواز، فشاری کەم…)؛ <b>بازنەی خۆڵەمێشی</b> یەک ڕاپۆرتە کە هێشتا کەس پشتڕاستی نەکردووەتەوە؛ <b>سەوز</b> واتە خەڵک دەڵێن گەڕاوەتەوە؛ <b>شین</b> بڕانێکە تیمەکە پێشوەختە ڕایگەیاندووە.",
      kmr: "Li ser nexşe û lîsteyan: <b>sor</b> tê wateya ku herî kêm du kes dibêjin kehreba an av tune; <b>porteqalî</b> pirsgirêkên din (voltaja qels, pesta kêm…); <b>xeleka gewr</b> raporek tenê ye ku hêj kesî piştrast nekiriye; <b>kesk</b> tê wateya ku vegeriyaye; <b>şîn</b> qutbûneke ku tîm ji berê ve ragihandiye.",
      ar: "على الخريطة والقوائم: <b>الأحمر</b> يعني أن شخصين على الأقل يقولون لا كهرباء أو لا ماء؛ <b>البرتقالي</b> مشاكل أخرى (فولتية ضعيفة، ضغط منخفض…)؛ <b>الحلقة الرمادية</b> بلاغ واحد لم يؤكده أحد بعد؛ <b>الأخضر</b> يعني أنها عادت؛ <b>الأزرق</b> انقطاع أعلنه الفريق مسبقًا.",
    },
    mapAbout: {
      en: "The map shows every neighbourhood on the real street map. Black labels are places with no power or no water; tap one to see its reports. You can filter by electricity or water.",
      ckb: "نەخشەکە هەموو گەڕەکێک لەسەر نەخشەی ڕاستەقینەی شەقامەکان پیشان دەدات. نیشانە ڕەشەکان ئەو شوێنانەن کە کارەبا یان ئاویان نییە؛ دەستی لێ بدە بۆ بینینی ڕاپۆرتەکانی. دەتوانیت تەنها کارەبا یان ئاو پیشان بدەیت.",
      kmr: "Nexşe her taxê li ser nexşeya rastîn a kolanan nîşan dide. Nîşanên reş ew cih in ku kehreba an av tune; li ser yekê bitikîne da ku raporên wê bibînî. Tu dikarî tenê kehreba an av nîşan bidî.",
      ar: "تُظهر الخريطة كل حيّ على خريطة الشوارع الحقيقية. العلامات السوداء أماكن بلا كهرباء أو ماء؛ اضغط على واحدة لترى بلاغاتها. يمكنك التصفية حسب الكهرباء أو الماء.",
    },
    areasHead: {
      en: "This site covers {n} neighbourhoods:",
      ckb: "ئەم ماڵپەڕە {n} گەڕەک دەگرێتەوە:",
      kmr: "Ev malper {n} taxan digire:",
      ar: "يغطي هذا الموقع {n} حيًّا:",
    },
    areasLink: { en: "All neighbourhoods", ckb: "هەموو گەڕەکەکان", kmr: "Hemû tax", ar: "كل الأحياء" },
    language: {
      en: "I understand English, Sorani (in Kurdish letters or Latin letters, like “slaw, karaba haya?”), Kurmanji and Arabic, and I reply in the one you write in. To change the website's language, tap the globe at the top of the page.",
      ckb: "لە ئینگلیزی، سۆرانی (بە پیتی کوردی یان لاتینی، وەک «slaw, karaba haya?»)، کرمانجی و عەرەبی تێدەگەم، و بەو زمانە وەڵام دەدەمەوە کە پێی دەنووسیت. بۆ گۆڕینی زمانی ماڵپەڕەکە، دەست لە گۆی زەوی لە سەرەوەی لاپەڕەکە بدە.",
      kmr: "Ez Îngilîzî, Soranî (bi tîpên kurdî an latînî), Kurmancî û Erebî fam dikim, û bi zimanê ku tu pê dinivîsî bersiv didim. Ji bo guhertina zimanê malperê, li ser goga li jor bitikîne.",
      ar: "أفهم الإنجليزية والسورانية (بالحروف الكردية أو اللاتينية، مثل «slaw, karaba haya?») والكرمانجية والعربية، وأجيب باللغة التي تكتب بها. لتغيير لغة الموقع، اضغط على الكرة الأرضية أعلى الصفحة.",
    },
    offline: {
      en: "After your first visit the site keeps itself on your phone, so it still opens when the internet drops during a cut. A red line at the top tells you when you're offline. The live map needs the internet.",
      ckb: "دوای یەکەم سەردان، ماڵپەڕەکە خۆی لەسەر مۆبایلەکەت هەڵدەگرێت، بۆیە کاتێک لە کاتی بڕانی کارەبادا ئینتەرنێت دەبڕێت هەر دەکرێتەوە. هێڵێکی سوور لە سەرەوە پێت دەڵێت کە ئۆفلاینیت. نەخشەی ڕاستەوخۆ پێویستی بە ئینتەرنێتە.",
      kmr: "Piştî serdana te ya yekem, malper xwe li ser telefona te diparêze, ji ber vê gava înternet di dema qutbûnê de diçe jî vedibe. Xeteke sor li jor nîşan dide ku tu offline yî. Nexşeya zindî înternetê dixwaze.",
      ar: "بعد زيارتك الأولى يحفظ الموقع نفسه على هاتفك، فيفتح حتى عندما ينقطع الإنترنت أثناء انقطاع الكهرباء. يظهر خط أحمر في الأعلى عندما تكون غير متصل. الخريطة الحيّة تحتاج إلى الإنترنت.",
    },
    etaWhere: {
      en: "Which neighbourhood? Tell me and I'll check whether the team has given a time.",
      ckb: "کام گەڕەک؟ پێم بڵێ و سەیر دەکەم کە تیمەکە کاتێکی دیاری کردووە یان نا.",
      kmr: "Kîjan tax? Ji min re bêje û ez ê binêrim ka tîmê demek daye yan na.",
      ar: "أي حي؟ قل لي وسأتحقق إن كان الفريق أعطى وقتًا.",
    },
    etaPlanned: {
      en: "The planned cut in {area} is set to end at {time}. That's the team's own time, so it can run a little over.",
      ckb: "بڕانە پلانکراوەکەی {area} بڕیارە لە {time} کۆتایی بێت. ئەوە کاتی خودی تیمەکەیە، بۆیە لەوانەیە کەمێک درێژە بکێشێت.",
      kmr: "Qutbûna plankirî li {area} divê di {time} de biqede. Ew dema tîmê bi xwe ye, ji ber vê dibe ku hinekî dirêjtir bikişîne.",
      ar: "القطع المجدول في {area} مقرر أن ينتهي الساعة {time}. هذا وقت الفريق نفسه، فقد يتأخر قليلًا.",
    },
    etaUnknown: {
      en: "Nobody has given a time for {area} yet, and I won't guess one. The neighbourhood page changes by itself the moment the team marks it fixed.",
      ckb: "هێشتا کەس کاتێکی بۆ {area} دیاری نەکردووە، و منیش مەزەندە ناکەم. پەڕەی گەڕەکەکە هەر کە تیمەکە وەک چاککراو نیشانی بکات، خۆی دەگۆڕێت.",
      kmr: "Hîn kesî ji bo {area} dem nedaye, û ez texmîn nakim. Rûpela taxê gava tîm wê wek çêkirî nîşan bike bi xwe diguhere.",
      ar: "لم يعطِ أحد وقتًا لـ{area} بعد، ولن أخمّن. تتغير صفحة الحي تلقائيًا لحظة يعلّمه الفريق كمُصلَح.",
    },
    etaNothing: {
      en: "There's nothing open for {area} right now: no reports in the last 24 hours and no planned cut.",
      ckb: "ئێستا هیچ شتێکی کراوە بۆ {area} نییە: نە ڕاپۆرت لە ٢٤ کاتژمێری ڕابردوودا و نە بڕانی پلانکراو.",
      kmr: "Niha ji bo {area} tiştek vekirî nîne: ne rapor di 24 saetên dawî de, ne jî qutbûneke plankirî.",
      ar: "لا شيء مفتوح لـ{area} الآن: لا بلاغات خلال آخر ٢٤ ساعة ولا قطع مجدول.",
    },
    whyUnconfirmed: {
      en: "It says “not confirmed yet” because only one person has reported it. As soon as a second neighbour reports the same thing, or the team confirms it, it counts as real.",
      ckb: "دەڵێت «هێشتا پشتڕاست نەکراوەتەوە» چونکە تەنها یەک کەس ڕاپۆرتی کردووە. هەر کە دراوسێیەکی دووەم هەمان شت ڕاپۆرت بکات، یان تیمەکە پشتڕاستی بکاتەوە، ڕاستەقینە دادەنرێت.",
      kmr: "Dibêje «hîn nehatiye piştrastkirin» ji ber ku tenê kesekî ragihandiye. Gava cîranekî duyem heman tiştî ragihîne, an tîm piştrast bike, wek rast tê hesibandin.",
      ar: "يقول «غير مؤكد بعد» لأن شخصًا واحدًا فقط بلّغ عنه. حالما يبلّغ جار ثانٍ عن الشيء نفسه، أو يؤكده الفريق، يُعتبر حقيقيًا.",
    },
    whyNone: {
      en: "“No reports” means nobody there has reported anything in the last 24 hours. It usually means things are fine, but not always: someone has to be first.",
      ckb: "«هیچ ڕاپۆرتێک نییە» واتە لە ٢٤ کاتژمێری ڕابردوودا کەس لەوێ هیچی ڕاپۆرت نەکردووە. زۆرجار واتای ئەوەیە کە شتەکان باشن، بەڵام هەمیشە نا: دەبێت کەسێک یەکەم بێت.",
      kmr: "«Rapor tune» tê wê wateyê ku di 24 saetên dawî de kesî li wir tiştek ragihandiye. Bi gelemperî tê wateya ku her tişt baş e, lê ne her tim: divê yek pêşî be.",
      ar: "«لا بلاغات» تعني أن أحدًا هناك لم يبلّغ عن شيء خلال آخر ٢٤ ساعة. غالبًا يعني أن الأمور بخير، لكن ليس دائمًا: لا بد أن يكون أحد هو الأول.",
    },
    whyPlanned: {
      en: "Planned cuts come from the electricity and water teams themselves, usually for maintenance or new lines. The reason they gave is shown with each cut.",
      ckb: "بڕانە پلانکراوەکان لە خودی تیمەکانی کارەبا و ئاوەوە دێن، زۆرجار بۆ چاککردنەوە یان هێڵی نوێ. ئەو هۆکارەی دایانناوە لەگەڵ هەر بڕانێک نیشان دەدرێت.",
      kmr: "Qutbûnên plankirî ji tîmên kehrebê û avê bi xwe tên, bi gelemperî ji bo lênêrînê an xetên nû. Sedema ku dane bi her qutbûnê re tê nîşandan.",
      ar: "القطوع المجدولة تأتي من فرق الكهرباء والماء أنفسهم، غالبًا للصيانة أو لخطوط جديدة. ويظهر السبب الذي ذكروه مع كل قطع.",
    },
    whyGeneral: {
      en: "Everything here comes from neighbours' reports and from the teams. A report counts once two people send it or the team confirms it, and it disappears after 24 hours without new reports.",
      ckb: "هەموو شتێک لێرە لە ڕاپۆرتی دراوسێکان و تیمەکانەوە دێت. ڕاپۆرتێک کاتێک حیساب دەکرێت کە دوو کەس بینێرن یان تیمەکە پشتڕاستی بکاتەوە، و دوای ٢٤ کاتژمێر بێ ڕاپۆرتی نوێ نامێنێت.",
      kmr: "Her tiştê li vir ji raporên cîranan û ji tîman tê. Raporek tê hesibandin gava du kes bişînin an tîm piştrast bike, û piştî 24 saetan bê raporên nû winda dibe.",
      ar: "كل ما هنا يأتي من بلاغات الجيران ومن الفرق. يُحتسب البلاغ عندما يرسله شخصان أو يؤكده الفريق، ويختفي بعد ٢٤ ساعة دون بلاغات جديدة.",
    },
    human: {
      en: "Of course. I can put you through to a person from the team, here in this chat. Tell me which team: electricity or water.",
      ckb: "بێگومان. دەتوانم لێرە لەم چاتەدا بتگەیەنمە کەسێک لە تیمەکە. پێم بڵێ کام تیم: کارەبا یان ئاو.",
      kmr: "Bê guman. Ez dikarim te li vir di vê sohbetê de bigihînim kesekî ji tîmê. Ji min re bêje kîjan tîm: kehreb an av.",
      ar: "بالتأكيد. يمكنني تحويلك إلى شخص من الفريق هنا في هذه المحادثة. قل لي أي فريق: الكهرباء أم الماء.",
    },
    danger: {
      en: "If you see a fallen cable, sparks, smoke or a burning transformer: stay well away, keep children back, don't touch anything metal near it, and call Erbil's emergency line, 122. Once you're safe, report it here as “Damaged cable or transformer” so neighbours keep away too.",
      ckb: "ئەگەر کێبڵێکی کەوتوو، پریشک، دووکەڵ یان مەحەوەلەیەکی سووتاوت بینی: زۆر دوور بکەوەوە، منداڵەکان دوور بخەرەوە، دەست لە هیچ شتێکی ئاسنی نزیکی مەدە، و پەیوەندی بە هێڵی فریاکەوتنی هەولێر بکە، ١٢٢. دوای ئەوەی سەلامەت بوویت، لێرە وەک «کێبڵ یان مەحەوەلەی تێکچوو» ڕایبگەیەنە بۆ ئەوەی دراوسێکانیش دوور بکەونەوە.",
      kmr: "Heke kabloyeke ketî, çirûsk, dû an transformatoreke dişewite dibînî: pir dûr bikeve, zarokan dûr bixe, dest nede tiştekî metal li nêzîkê, û li xeta acîl a Hewlêrê bigere, 122. Gava tu ewle bûyî, li vir wek «Kablo an transformatora xerabûyî» ragihîne da ku cîran jî dûr bikevin.",
      ar: "إذا رأيت سلكًا ساقطًا أو شرارًا أو دخانًا أو محولة تحترق: ابتعد كثيرًا، أبعد الأطفال، لا تلمس أي شيء معدني قريب، واتصل بخط طوارئ أربيل ١٢٢. وعندما تكون بأمان، بلّغ هنا عن «كابل أو محولة متضررة» حتى يبتعد الجيران أيضًا.",
    },
    insult: {
      en: "Sorry, that wasn't much help. Short questions work best, like:",
      ckb: "ببورە، زۆر یارمەتیدەر نەبووم. پرسیاری کورت باشترە، وەک:",
      kmr: "Bibore, ez pir alîkar nebûm. Pirsên kurt çêtir in, wek:",
      ar: "آسف، لم أفدك كثيرًا. الأسئلة القصيرة أفضل، مثل:",
      ckbl: "Bbura, zor yarmatidar nabum. Prsyari kurt bashtra, wak:",
    },
    yesno: {
      en: "OK! What would you like to know?",
      ckb: "باشە! چیت دەوێت بزانیت؟",
      kmr: "Baş e! Tu dixwazî çi bizanî?",
      ar: "تمام! ماذا تريد أن تعرف؟",
      ckbl: "Basha! Chit dawet bzanit?",
    },
    guess: {
      en: "Not sure what you mean. One of these?",
      ckb: "دڵنیا نیم مەبەستت چییە. یەکێک لەمانە؟",
      kmr: "Ne bawer im tu çi dixwazî. Yek ji van?",
      ar: "لست متأكدًا مما تقصد. واحد من هذه؟",
      ckbl: "Dlniya nim mabastit chiya. Yakek lamana?",
    },
    plannedHead: {
      en: "Cuts the team has announced for the next 24 hours:",
      ckb: "ئەو بڕانانەی تیمەکە بۆ ٢٤ کاتژمێری داهاتوو ڕایگەیاندوون:",
      kmr: "Qutbûnên ku tîm ji bo 24 saetên bê ragihandine:",
      ar: "الانقطاعات التي أعلنها الفريق خلال الـ٢٤ ساعة القادمة:",
    },
    plannedNone: {
      en: "The team hasn't announced any planned power or water cuts for the next 24 hours.",
      ckb: "تیمەکە هیچ بڕانێکی پلانکراوی کارەبا یان ئاوی بۆ ٢٤ کاتژمێری داهاتوو ڕانەگەیاندووە.",
      kmr: "Tîm ji bo 24 saetên bê tu qutbûneke plankirî ya kehreba an avê ranegihandiye.",
      ar: "لم يعلن الفريق عن أي انقطاع مجدول للكهرباء أو الماء خلال الـ٢٤ ساعة القادمة.",
    },
    listNone: {
      en: "No one has reported {what} in the last 24 hours.",
      ckb: "لە ٢٤ کاتژمێری ڕابردوودا کەس {what}ی ڕانەگەیاندووە.",
      kmr: "Di 24 saetên dawî de kesî {what} ranegihandine.",
      ar: "لم يبلّغ أحد عن {what} خلال آخر ٢٤ ساعة.",
    },
    seeMap: { en: "See the map", ckb: "نەخشەکە ببینە", kmr: "Nexşeyê bibîne", ar: "افتح الخريطة" },
    billAnswer: {
      en: "{kwh} kWh comes to about <b>{total} IQD</b> a month on the Runaki tariff:",
      ckb: "{kwh} کیلۆوات‌کاتژمێر بە نرخی ڕووناکی مانگانە نزیکەی <b>{total} دینار</b> دەبێت:",
      kmr: "{kwh} kWh bi tarîfeya Runakî mehê nêzîkî <b>{total} dînar</b> e:",
      ar: "{kwh} كيلوواط ساعة تكلّف حوالي <b>{total} دينار</b> شهريًا حسب تعرفة روناكي:",
    },
    billLine: {
      en: "{kwh} kWh × {price} IQD",
      ckb: "{kwh} × {price} دینار",
      kmr: "{kwh} kWh × {price} dînar",
      ar: "{kwh} × {price} دينار",
    },
    billNoNumber: {
      en: 'Homes pay by band: the first 400 kWh at 72 IQD, 401–800 at 108, 801–1,200 at 175, 1,201–1,600 at 265, and anything above at 350. Tell me how many kWh you used and I\'ll work it out, for example "how much is 650 kWh?"',
      ckb: "ماڵان بەپێی پلە پارە دەدەن: یەکەم ٤٠٠ کیلۆوات بە ٧٢ دینار، ٤٠١–٨٠٠ بە ١٠٨، ٨٠١–١٢٠٠ بە ١٧٥، ١٢٠١–١٦٠٠ بە ٢٦٥، و زیاتر لەوە بە ٣٥٠. پێم بڵێ چەند کیلۆوات بەکارهێناوە و بۆت حساب دەکەم، بۆ نموونە «٦٥٠ کیلۆوات چەندە؟»",
      kmr: "Mal li gorî astan didin: 400 kWh yên pêşîn bi 72 dînar, 401–800 bi 108, 801–1,200 bi 175, 1,201–1,600 bi 265, û jê zêdetir bi 350. Ji min re bibêje te çend kWh bi kar anî û ez ê hesab bikim, mînak «650 kWh çiqas e?»",
      ar: "تدفع المنازل حسب الشرائح: أول ٤٠٠ كيلوواط بـ٧٢ دينارًا، ٤٠١–٨٠٠ بـ١٠٨، ٨٠١–١٢٠٠ بـ١٧٥، ١٢٠١–١٦٠٠ بـ٢٦٥، وما فوق ذلك بـ٣٥٠. أخبرني كم كيلوواط استهلكت وسأحسبها، مثلًا «كم سعر ٦٥٠ كيلوواط؟»",
    },
    billLink: {
      en: "Open the bill calculator",
      ckb: "حاسیبەی پسوولە بکەرەوە",
      kmr: "Hesabkerê fatûreyê veke",
      ar: "افتح حاسبة الفاتورة",
    },
    pay: {
      en: "Runaki bills are paid online through <b>e-Psûle</b>, the government payments service. Its site lists the apps and banks that accept them.",
      ckb: "پسوولەکانی ڕووناکی بە ئۆنلاین لە ڕێگەی <b>ئی-پسوولە</b>وە دەدرێن، کە خزمەتگوزاری پارەدانی حکومەتە. ماڵپەڕەکەی ئەو ئەپ و بانکانە پیشان دەدات کە وەریدەگرن.",
      kmr: "Fatûreyên Runakî bi awayê serhêl bi rêya <b>e-Psûle</b> tên dayîn, ku xizmeta dayînê ya hikûmetê ye. Malpera wê sepan û bankên ku wan qebûl dikin nîşan dide.",
      ar: "تُدفع فواتير روناكي إلكترونيًا عبر <b>إي-بسولة</b>، خدمة الدفع الحكومية. يعرض موقعها التطبيقات والبنوك التي تقبلها.",
    },
    payLink: { en: "Go to e-Psûle", ckb: "بڕۆ بۆ ئی-پسوولە", kmr: "Here e-Psûleyê", ar: "افتح إي-بسولة" },
    runakiAbout: {
      en: "Runaki is the KRG programme bringing 24-hour grid electricity to neighbourhoods, so homes no longer need a generator subscription. In the areas this site tracks:",
      ckb: "ڕووناکی پرۆگرامی حکومەتی هەرێمە بۆ گەیاندنی کارەبای ٢٤ کاتژمێری تۆڕ بە گەڕەکەکان، تا ماڵەکان پێویستیان بە بەشداری مۆلیدە نەمێنێت. لەو ناوچانەی ئەم ماڵپەڕە بەدوایاندا دەچێت:",
      kmr: "Runakî bernameya HHKê ye ku kehreba torê ya 24 saetan digihîne taxan, da ku mal êdî ne hewceyî abonetiya moelîdeyê bin. Li herêmên ku ev malper dişopîne:",
      ar: "روناكي برنامج حكومة الإقليم لإيصال كهرباء الشبكة على مدار ٢٤ ساعة إلى الأحياء، حتى لا تحتاج البيوت إلى اشتراك المولدة. في المناطق التي يتابعها هذا الموقع:",
    },
    runakiArea: {
      en: "<b>{area}</b>: {status}.",
      ckb: "<b>{area}</b>: {status}.",
      kmr: "<b>{area}</b>: {status}.",
      ar: "<b>{area}</b>: {status}.",
    },
    runakiLink: { en: "Runaki and bills", ckb: "ڕووناکی و پسوولە", kmr: "Runakî û fatûre", ar: "روناكي والفواتير" },
    runakiOfficial: {
      en: "The official list is on runaki.gov.krd.",
      ckb: "لیستی فەرمی لە runaki.gov.krd دایە.",
      kmr: "Lîsteya fermî li ser runaki.gov.krd e.",
      ar: "القائمة الرسمية على runaki.gov.krd.",
    },
    generator: {
      en: "Where Runaki has arrived, the neighbourhood generator is being phased out. Where it hasn't, households still pay generator owners by the ampere. Want to compare? Type what you paid last month into the calculator.",
      ckb: "لەو شوێنانەی ڕووناکی گەیشتووە، مۆلیدەی گەڕەک وردە وردە لادەبرێت. لەو شوێنانەی نەگەیشتووە، ماڵەکان هێشتا بە ئەمپێر پارە بە خاوەن مۆلیدە دەدەن. دەتەوێت بەراورد بکەیت؟ ئەوەی مانگی ڕابردوو داوتە لە حاسیبەکەدا بنووسە.",
      kmr: "Li cihên ku Runakî gihîştiye, moelîdeya taxê hêdî hêdî tê rakirin. Li cihên ku negihîştiye, mal hê jî li gorî ampêran pere didin xwediyên moelîdeyê. Dixwazî bidî ber hev? Ya ku te meha borî da, di hesabkerê de binivîse.",
      ar: "حيث وصلت روناكي يجري الاستغناء عن مولدة الحي تدريجيًا. وحيث لم تصل، ما زالت البيوت تدفع لأصحاب المولدات بالأمبير. تريد المقارنة؟ اكتب ما دفعته الشهر الماضي في الحاسبة.",
    },
    report: {
      en: "Tap <b>Report a problem</b> at the top of any page. Choose electricity or water, what's wrong and your neighbourhood. That's all. No name or phone number needed. If someone already reported it, tap <b>Me too</b> instead.",
      ckb: "لە سەرەوەی هەر پەڕەیەک <b>ڕاگەیاندنی کێشە</b> دابگرە. کارەبا یان ئاو، کێشەکە و گەڕەکەکەت هەڵبژێرە. ئەوەندە. پێویست بە ناو یان ژمارەی مۆبایل ناکات. ئەگەر کەسێک پێشتر ڕایگەیاندبوو، لەبری ئەوە <b>منیش</b> دابگرە.",
      kmr: "Li jorê her rûpelê li <b>Pirsgirêkekê ragihîne</b> bitikîne. Kehreba an av, pirsgirêk û taxa xwe hilbijêre. Ev bes e. Nav an hejmara telefonê ne pêwîst e. Heke kesekî berê ragihandibe, li şûna wê li <b>Li cem min jî</b> bitikîne.",
      ar: "اضغط <b>بلّغ عن مشكلة</b> أعلى أي صفحة. اختر الكهرباء أو الماء، والمشكلة، وحيّك. هذا كل شيء. لا حاجة لاسم أو رقم هاتف. إذا كان أحد قد أبلغ مسبقًا، اضغط <b>عندي أيضًا</b> بدلًا من ذلك.",
    },
    reportLink: { en: "Report a problem", ckb: "ڕاگەیاندنی کێشە", kmr: "Pirsgirêkekê ragihîne", ar: "بلّغ عن مشكلة" },
    quality: {
      en: "If your water looks, smells or tastes wrong, don't drink it or cook with it until it runs clear again or the water directorate says it's safe. Please report it so your neighbours know to check theirs.",
      ckb: "ئەگەر ئاوەکەت ڕەنگ، بۆن یان تامی ئاسایی نییە، مەیخۆرەوە و چێشتی پێ لێمەنێ تا ڕوون دەبێتەوە یان بەڕێوەبەرایەتی ئاو دەڵێت سەلامەتە. تکایە ڕایبگەیەنە تا دراوسێکانت ئاوی خۆیان بپشکنن.",
      kmr: "Heke rengê, bêhn an tama ava te ne normal be, wê venexwe û pê xwarinê çênebike heta ku dîsa zelal bibe an rêveberiya avê bibêje ewle ye. Ji kerema xwe ragihîne da ku cîranên te ava xwe kontrol bikin.",
      ar: "إذا كان لون الماء أو رائحته أو طعمه غير طبيعي، فلا تشربه ولا تطبخ به حتى يصفو أو تعلن مديرية الماء أنه آمن. من فضلك بلّغ عنه ليتحقق جيرانك من مائهم.",
    },
    about: {
      en: "I'm the helper on Erbil Utilities, a community site, not a government service. I answer only from what's on this site: neighbours' reports, Runaki coverage and the published tariff. For anything official, check runaki.gov.krd or epsule.gov.krd.",
      ckb: "من یاریدەدەری خزمەتگوزارییەکانی هەولێرم، ماڵپەڕێکی کۆمەڵایەتی، نەک خزمەتگوزاری حکومی. تەنها لەو شتانەوە وەڵام دەدەمەوە کە لەم ماڵپەڕەدان: ڕاپۆرتی دراوسێکان، داپۆشینی ڕووناکی و نرخی بڵاوکراوە. بۆ هەر شتێکی فەرمی سەیری runaki.gov.krd یان epsule.gov.krd بکە.",
      kmr: "Ez alîkarê Xizmetên Hewlêrê me, malperek civakî, ne xizmeteke hikûmetê. Ez tenê ji tiştên li ser vê malperê bersiv didim: raporên cîranan, belavbûna Runakî û tarîfeya weşandî. Ji bo her tiştê fermî li runaki.gov.krd an epsule.gov.krd binêre.",
      ar: "أنا مساعد موقع خدمات أربيل، وهو موقع مجتمعي وليس خدمة حكومية. أجيب فقط مما في هذا الموقع: بلاغات الجيران وتغطية روناكي والتعرفة المنشورة. لأي أمر رسمي راجع runaki.gov.krd أو epsule.gov.krd.",
    },
    latinSorani: {
      en: "",
      ckb: "",
      ar: "",
      kmr: "(Ez bi tîpên latînî bersiv didim. Ji bo Soranî, zimanê rûpelê bike کوردی.)",
    },
  };

  /* ------------------------------------------------------------------ *
   * Prepared lookups
   * ------------------------------------------------------------------ */
  const NW = {};
  for (const k in WORDS) NW[k] = Array.from(new Set(WORDS[k].map(N)));
  const NL = {};
  for (const k in LANG_WORDS) NL[k] = new Set(LANG_WORDS[k].map(N));

  // Sorani words written in Latin letters (common on phones)
  // (the "Sorani in Latin letters" people type on phones: slaw, choni, karaba haya?)
  const SORANI_LATIN = new Set(
    (
      "karaba kareba karabay karabakan haya hayn niya nya nia nie nyya la chon choni chony chonit chona chand chande chanda kwe kwê slaw slaaw salaw supas spas awi aw " +
      "bo bochi boche eme ema ewa awa ama chi chiya chya chit kaba garak garaka garakakan gerek bashi bashit bashm bash basha bashe ahwal ahwalt xoshi xoshit chakit chaki " +
      "zor zorspas dastxosh bbura bburre bale bali baly naxer tkaya tkayә xwahafiz khwahafiz xwa hafiz shaw bayani ewara rozhbash kaka kak bra gyan " +
      "mala malakam malakaman mali mn min tanha tanya hat hatawa hatotawa brrawa brawa qata qat mulida moleda mewlida ampir pswla psula nrx nirx para " +
      "kam kay ki kei datwanm datwanit dakat dakam dakait bkam bka bkat bprsm bzanm nazanm pem bley bley bllem hich hichi esta amro amrro sbayne " +
      "hawler hewler shar drawse dravse raport ragayandin rabgayanm zhmara zhmaray paywandi timaka wasta sardan hawal hewal xabar taza zman zmani kurdi arabi " +
      "chakm basham xoshm mn tu ema ewa aw ama yan w u ish dakre dabet nabet heya hich"
    )
      .split(/\s+/)
      .map(N),
  );
  // words that are only Kurmanji, so "aw/la/bo" alone don't pull Kurmanji into Sorani
  const KMR_ONLY = new Set(
    "li ji heye hene tune nîne nine çi ci çawa cawa niha îro iro kîjan kijan dikarim dikarî bikim ragihînim jî ji bo kengî kengi ez em hûn hun xwe çima cima erê ere silav spas te min ye e im î"
      .split(" ")
      .map(N),
  );

  const AREA_TERMS = EU.AREAS.map((a) => ({
    area: a,
    terms: Array.from(new Set([a.name.en, a.name.ckb, a.name.kmr, a.name.ar].concat(a.alt || []).map(N))).filter(
      (t) => t.length >= 3,
    ),
  }));

  const isArabicScript = (s) => /[؀-ۿ]/.test(s);

  function tokens(norm) {
    return norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  // Levenshtein distance, capped, for typos in Latin words
  function nearlySame(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    let i = 0,
      j = 0,
      edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // Does the normalised question contain this normalised word/phrase?
  function has(norm, toks, word) {
    if (word.includes(" ")) return norm.includes(word);
    if (isArabicScript(word)) {
      // Kurdish/Arabic attach prefixes and suffixes (لە، بە، ال، ـەکە، ـی…),
      // so look for the word inside tokens; short words must match exactly.
      return word.length <= 2 ? toks.includes(word) : toks.some((t) => t.includes(word));
    }
    if (toks.includes(word)) return true;
    // Kurmanji suffixes: kehrebe → kehrebeyê, av → avê
    if (word.length >= 4 && toks.some((t) => t.startsWith(word) && t.length - word.length <= 3)) return true;
    // one-letter typos for longer words
    // (but an everyday English word is never a typo of another: "there" isn't "where")
    return word.length >= 5 && toks.some((t) => t.length >= 4 && !NL.en.has(t) && nearlySame(t, word));
  }
  const any = (norm, toks, list) => list.some((w) => has(norm, toks, w));

  /* ------------------------------------------------------------------ *
   * 1. Language
   * ------------------------------------------------------------------ */
  function detectLang(text) {
    const raw = String(text);
    const norm = N(raw);
    const toks = tokens(norm);

    if (isArabicScript(raw)) {
      let ckb = (raw.match(/[ەۆێڵڕڤ]/g) || []).length * 2;
      let ar = (raw.match(/[ةىذضظثإأ]/g) || []).length * 2;
      ar += (raw.match(/(^|\s)ال/g) || []).length * 2;
      for (const t of toks) {
        if (NL.ckb.has(t)) ckb += 1;
        if (NL.ar.has(t)) ar += 1;
      }
      // Sorani spelling uses ی ک where Arabic uses ي ك
      if (/[يك]/.test(raw)) ar += 1;
      if (/[یک]/.test(raw) && !/[يك]/.test(raw)) ckb += 1;
      if (ckb === ar) return EU.lang === "ar" ? "ar" : "ckb";
      return ckb > ar ? "ckb" : "ar";
    }

    if (/[a-z]/i.test(raw)) {
      let kmr = (raw.match(/[êîûçşÊÎÛÇŞ]/g) || []).length * 3;
      let en = 0;
      let soraniLatin = 0;
      for (const t of toks) {
        if (NL.kmr.has(t)) kmr += 1;
        if (NL.en.has(t)) en += 1;
        if (SORANI_LATIN.has(t)) soraniLatin += 1;
      }
      // Sorani typed in Latin letters: Sorani words, sh/ch/zh spellings, and
      // no Kurmanji-only letters or words
      const kmrOnly = toks.filter((t) => KMR_ONLY.has(t)).length + (raw.match(/[êîûçşÊÎÛÇŞ]/g) || []).length;
      const shCh = (norm.match(/sh|ch|zh|xw|aka\b|akan\b|awa\b/g) || []).length;
      if (soraniLatin > 0 && soraniLatin + shCh * 0.5 > kmrOnly && soraniLatin + shCh * 0.5 > en) return "ckbl";
      if (kmr === en) return EU.lang === "ckb" ? "ckbl" : EU.lang; // can't tell, so stay with the page language
      return kmr > en ? "kmr" : "en";
    }
    return EU.lang; // only digits / emoji: keep the page language
  }

  /* ------------------------------------------------------------------ *
   * 2. Understanding
   * ------------------------------------------------------------------ */
  function findNumber(text) {
    const norm = N(text).replace(/(\d)[,٬.\s](\d{3})\b/g, "$1$2");
    const m = norm.match(/\d+(?:\.\d+)?/g);
    if (!m) return null;
    // ignore "24" when it's part of "24 hour"
    const nums = m.map(Number).filter((n) => n !== 24 || !/24\s*(h|hour|saet|seat|کاتژمێر|کاتژمیر|ساع)/.test(norm));
    return nums.length ? Math.max.apply(null, nums) : null;
  }

  function findAreas(norm, toks) {
    const found = [];
    for (const { area, terms } of AREA_TERMS) {
      if (terms.some((t) => has(norm, toks, t))) found.push(area);
    }
    if (found.length) return found;
    // A typo in a neighbourhood name ("Ankwa", "عنكاو", "Brayeti"): one letter
    // off, for names of five letters or more, in any script
    for (const { area, terms } of AREA_TERMS) {
      if (
        terms.some(
          (t) =>
            !t.includes(" ") && t.length >= 5 && toks.some((w) => w.length >= 4 && !NL.en.has(w) && nearlySame(w, t)),
        )
      )
        found.push(area);
    }
    if (found.length) return found;
    // "here", "my area", "لای ئێمە": the neighbourhood picked on the home page
    if (any(norm, toks, NW.here) && EU.myArea && EU.myArea()) {
      const mine = EU.AREAS.find((a) => a.slug === EU.myArea());
      if (mine) found.push(mine);
    }
    return found;
  }

  function understand(text) {
    const norm = N(text);
    const toks = tokens(norm);
    const q = {
      norm,
      toks,
      areas: findAreas(norm, toks),
      power: any(norm, toks, NW.electricity),
      water: any(norm, toks, NW.water),
      out: any(norm, toks, NW.out),
      where: any(norm, toks, NW.where),
      bill: any(norm, toks, NW.bill),
      pay: any(norm, toks, NW.pay),
      runaki: any(norm, toks, NW.runaki),
      planned: any(norm, toks, NW.planned),
      howareyou: any(norm, toks, NW.howareyou),
      bye: any(norm, toks, NW.bye),
      whoami: any(norm, toks, NW.whoami),
      news: any(norm, toks, NW.news),
      private: any(norm, toks, NW.private),
      contact: any(norm, toks, NW.contact),
      privacy: any(norm, toks, NW.privacy),
      trust: any(norm, toks, NW.trust),
      map: any(norm, toks, NW.map),
      areasList: any(norm, toks, NW.areas),
      language: any(norm, toks, NW.language),
      offline: any(norm, toks, NW.offline),
      danger: any(norm, toks, NW.danger),
      human: any(norm, toks, NW.human),
      long: any(norm, toks, NW.long),
      frustrated: any(norm, toks, NW.frustrated),
      callcentre: any(norm, toks, NW.callcentre),
      deadline: any(norm, toks, NW.deadline),
      cutoff: any(norm, toks, NW.cutoff),
      olddebt: any(norm, toks, NW.olddebt),
      register: any(norm, toks, NW.register),
      meter: any(norm, toks, NW.meter),
      overpaid: any(norm, toks, NW.overpaid),
      runakiwhen: any(norm, toks, NW.runakiwhen),
      cancel: any(norm, toks, NW.cancel),
      tanker: any(norm, toks, NW.tanker),
      connect: any(norm, toks, NW.connect),
      tired: any(norm, toks, NW.tired),
      care: any(norm, toks, NW.care),
      heat: any(norm, toks, NW.heat),
      fridge: any(norm, toks, NW.fridge),
      save: any(norm, toks, NW.save),
      tank: any(norm, toks, NW.tank),
      yes: toks.length <= 4 && any(norm, toks, NW.yes),
      no: toks.length <= 4 && any(norm, toks, NW.no),
      breaker: any(norm, toks, NW.breaker),
      flicker: any(norm, toks, NW.flicker),
      weak: any(norm, toks, NW.weak),
      dirty: any(norm, toks, NW.dirty),
      eta: any(norm, toks, NW.eta),
      why: any(norm, toks, NW.why),
      fixed: any(norm, toks, NW.fixed),
      insult: any(norm, toks, NW.insult),
      yesno: toks.length <= 3 && any(norm, toks, NW.yesno),
      generator: any(norm, toks, NW.generator),
      report: any(norm, toks, NW.report),
      quality: any(norm, toks, NW.quality),
      about: any(norm, toks, NW.about),
      help: any(norm, toks, NW.help),
      greet: any(norm, toks, NW.greet),
      thanks: any(norm, toks, NW.thanks),
      track: any(norm, toks, NW.track) || /\beu-?[a-z0-9]{6}\b/i.test(text),
      alerts: any(norm, toks, NW.alerts),
      photo: any(norm, toks, NW.photo),
      number: findNumber(text),
    };
    // "kWh" or a big number with "how much" → a bill question
    if (q.number != null && (q.bill || /kwh|کیلۆ|کیلو|كيلو|کیلوو/.test(norm))) q.bill = true;
    return q;
  }

  /* ------------------------------------------------------------------ *
   * 3. Answers
   * ------------------------------------------------------------------ */
  let lastArea = null;
  let lastService = null;
  let lastIntent = null; // what the last answer was about, for follow-ups ("why?", "and Gulan?")
  let misses = 0; // answers in a row that didn't understand the question

  const r = (lang, key, params) => {
    let s = (R[key] && (R[key][lang] || R[key].en)) || "";
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
    return s;
  };
  const tt = (lang, key, params) => EU.esc(EU.tIn(lang, key, params));
  const nf = (lang, n) => EU.numIn(lang, n);
  const link = (href, text) => `<a href="${href}">${text}</a>`;
  const sep = (lang) => (lang === "ar" || lang === "ckb" ? "، " : ", ");

  // "Electricity: no power. No power (14 people, 20 min ago)". Plain words;
  // only "no power / no water" is marked, in red.
  function stateWord(service, state, lang) {
    const text = EU.esc(EU.stateText(service, state, lang));
    return state === "out" ? `<strong class="said-out">${text}</strong>` : `<strong>${text}</strong>`;
  }

  function serviceLine(lang, service, s) {
    const label = tt(lang, "svc." + service);
    if (s.state === "none") return `<li>${label}: ${tt(lang, "state.none")}</li>`;
    if (s.state === "back") {
      return `<li>${label}: ${stateWord(service, "back", lang)}${sep(lang)}${tt(lang, "time.last", { time: EU.ago(s.items[0].last, lang) })}</li>`;
    }
    const parts = s.open.map(
      (x) =>
        `${tt(lang, "p." + x.problem)} (${tt(lang, "people", { n: x.people })}${sep(lang)}${EU.esc(EU.ago(x.last, lang))})`,
    );
    return `<li>${label}: ${stateWord(service, s.state, lang)}<br>${parts.join("<br>")}</li>`;
  }

  function areaAnswer(lang, area, q) {
    const st = EU.Store.areaStatus(area.slug);
    const name = EU.esc(EU.pick(area.name, lang));
    const onlyPower = q.power && !q.water;
    const onlyWater = q.water && !q.power;
    const lines = [];
    if (!onlyWater) lines.push(serviceLine(lang, "electricity", st.electricity));
    if (!onlyPower) lines.push(serviceLine(lang, "water", st.water));
    let html = `<p>${r(lang, "areaHead", { area: name })}</p><ul>${lines.join("")}</ul>`;
    const planned = EU.Store.notices(area.slug).filter(
      (n) => (!onlyWater || n.service === "water") && (!onlyPower || n.service === "electricity"),
    );
    if (planned.length) html += `<p>${r(lang, "plannedHead")}</p><ul>${noticeLines(lang, planned)}</ul>`;

    const shown = [onlyWater ? null : st.electricity, onlyPower ? null : st.water].filter(Boolean);
    if (shown.every((s) => s.state === "none")) html += `<p>${r(lang, "noneMeansUnknown")}</p>`;

    if (!onlyWater || q.runaki) {
      const status =
        EU.tIn(lang, "runaki." + area.runaki) +
        (area.since ? " " + EU.tIn(lang, "runaki.since", { date: EU.monthName(area.since, lang) }) : "");
      html += `<p>${r(lang, "runakiLine", { status: EU.esc(status) })}</p>`;
    }
    html += `<p>${link("area.html?a=" + encodeURIComponent(area.slug), r(lang, "openArea", { area: name }))}${sep(lang)}${link("report.html?a=" + encodeURIComponent(area.slug) + (onlyWater ? "&s=water" : ""), r(lang, "reportIn"))}</p>`;
    return html;
  }

  function noticeLines(lang, list) {
    return list
      .map(
        (n) =>
          `<li><b>${tt(lang, "notice.kind." + n.service)}</b>: ${EU.esc(EU.noticeAreas(n, lang))}. ${n.now ? tt(lang, "notice.live") + sep(lang) : ""}${EU.esc(EU.noticeWhen(n, lang))}` +
          `${n.reason ? `<br>${EU.esc(EU.pick(n.reason, lang))}` : ""}</li>`,
      )
      .join("");
  }

  function plannedAnswer(lang, area, q) {
    const only = q.power && !q.water ? "electricity" : q.water && !q.power ? "water" : null;
    const list = EU.Store.notices(area ? area.slug : null, only);
    if (!list.length) return `<p>${r(lang, "plannedNone")}</p>`;
    return `<p>${r(lang, "plannedHead")}</p><ul>${noticeLines(lang, list)}</ul>`;
  }

  function listAnswer(lang, q) {
    const service = q.power && !q.water ? "electricity" : q.water && !q.power ? "water" : null;
    const what = r(lang, service === "electricity" ? "whatPower" : service === "water" ? "whatWater" : "whatBoth");
    const list = EU.Store.all();
    const rank = { out: 2, trouble: 1 };
    const rows = [];
    for (const a of EU.AREAS) {
      const st = EU.Store.areaStatus(a.slug, list);
      for (const svc of service ? [service] : ["electricity", "water"]) {
        const s = st[svc];
        if (s.state === "out" || s.state === "trouble") rows.push({ a, svc, s });
      }
    }
    if (!rows.length) return `<p>${r(lang, "listNone", { what })}</p>`;
    rows.sort((x, y) => rank[y.s.state] - rank[x.s.state] || y.s.people - x.s.people);
    const items = rows
      .slice(0, 8)
      .map(
        ({ a, svc, s }) =>
          `<li>${link("area.html?a=" + encodeURIComponent(a.slug), EU.esc(EU.pick(a.name, lang)))}: ` +
          `${stateWord(svc, s.state, lang)}${sep(lang)}${tt(lang, "people", { n: s.people })}</li>`,
      )
      .join("");
    return `<p>${r(lang, "listHead", { what })}</p><ul>${items}</ul><p>${link("map.html", r(lang, "seeMap"))}</p>`;
  }

  function billAnswer(lang, kwh) {
    if (kwh == null || kwh <= 0) {
      return `<p>${r(lang, "billNoNumber")}</p><p>${link("runaki.html", r(lang, "billLink"))}</p>`;
    }
    const bill = EU.billFor(kwh);
    const lines = bill.lines
      .map(
        (l) =>
          `<li>${r(lang, "billLine", { kwh: nf(lang, l.kwh), price: nf(lang, l.band.price) })} = ${nf(lang, l.cost)}</li>`,
      )
      .join("");
    return (
      `<p>${r(lang, "billAnswer", { kwh: nf(lang, kwh), total: nf(lang, bill.total) })}</p><ul>${lines}</ul>` +
      `<p>${link("runaki.html?kwh=" + Math.round(kwh), r(lang, "billLink"))}</p>`
    );
  }

  function runakiAnswer(lang, area) {
    if (area) {
      const status =
        EU.tIn(lang, "runaki." + area.runaki) +
        (area.since ? " " + EU.tIn(lang, "runaki.since", { date: EU.monthName(area.since, lang) }) : "");
      return (
        `<p>${r(lang, "runakiArea", { area: EU.esc(EU.pick(area.name, lang)), status: EU.esc(status) })}</p>` +
        `<p>${r(lang, "runakiOfficial")}</p><p>${link("runaki.html", r(lang, "runakiLink"))}</p>`
      );
    }
    const groups = ["covered", "switching", "notyet"]
      .map((g) => {
        const names = EU.AREAS.filter((a) => a.runaki === g).map((a) => EU.esc(EU.pick(a.name, lang)));
        return names.length ? `<li><b>${tt(lang, "runaki." + g)}</b>: ${names.join(sep(lang))}</li>` : "";
      })
      .join("");
    return (
      `<p>${r(lang, "runakiAbout")}</p><ul>${groups}</ul><p>${r(lang, "runakiOfficial")}</p>` +
      `<p>${link("runaki.html", r(lang, "runakiLink"))}</p>`
    );
  }

  /* ------------------------------------------------------------------ *
   * Sorani in Latin letters. People who type "slaw, karaba haya?" get the
   * answer back in the same informal Latin spelling. Hand-written replies
   * are used for small talk; everything else is the Sorani reply with its
   * letters converted (ش sh, چ ch, ژ zh, خ x, ە a, ێ e, ۆ o, وو u…).
   * ------------------------------------------------------------------ */
  const LAT = {
    ا: "a",
    آ: "a",
    ب: "b",
    پ: "p",
    ت: "t",
    ث: "s",
    ج: "j",
    چ: "ch",
    ح: "h",
    خ: "x",
    د: "d",
    ذ: "z",
    ر: "r",
    ڕ: "r",
    ز: "z",
    ژ: "zh",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "z",
    ط: "t",
    ظ: "z",
    ع: "",
    غ: "gh",
    ف: "f",
    ڤ: "v",
    ق: "q",
    ک: "k",
    ك: "k",
    گ: "g",
    ل: "l",
    ڵ: "l",
    م: "m",
    ن: "n",
    ه: "h",
    ھ: "h",
    ە: "a",
    ة: "a",
    ۆ: "o",
    ێ: "e",
    ى: "a",
    ئ: "",
    أ: "a",
    إ: "i",
    ء: "",
    "،": ",",
    "؟": "?",
    "؛": ";",
    "«": "“",
    "»": "”",
    "٫": ".",
    "٬": ",",
    "‌": "",
  };
  function latinWord(w) {
    let out = "";
    const vowelOut = () => /[aeiou]$/.test(out);
    for (let i = 0; i < w.length; i++) {
      const c = w[i],
        next = w[i + 1];
      const start = out === "";
      if (c === "و") {
        if (next === "و") {
          out += "u";
          i++;
          continue;
        }
        const hamza = start && w[i - 1] === "ئ"; // ئو at the start is the vowel u
        out += !hamza && (start || "اەۆێی".includes(next || "-") || /[aeo]$/.test(out)) ? "w" : "u";
      } else if (c === "ی" || c === "ي") {
        const hamza = start && w[i - 1] === "ئ"; // ئی at the start is the vowel i
        out += !hamza && (start || vowelOut() || "اەۆێ".includes(next || "-")) ? "y" : "i";
      } else if (c >= "٠" && c <= "٩") out += String(c.charCodeAt(0) - 0x660);
      else if (c >= "۰" && c <= "۹") out += String(c.charCodeAt(0) - 0x6f0);
      else out += c in LAT ? LAT[c] : c;
    }
    return out;
  }
  // names keep their capital letter
  const PROPER = new Map();
  ["هەولێر", "ڕووناکی", "کوردستان", "عێراق"].concat(EU.AREAS.map((a) => a.name.ckb)).forEach((n) => {
    n.split(/\s+/).forEach((w) => {
      const l = latinWord(w);
      PROPER.set(l, l[0].toUpperCase() + l.slice(1));
    });
  });
  function latinize(html) {
    const out = html
      .split(/(<[^>]+>)/)
      .map((part) => {
        if (part.startsWith("<")) return part;
        return part.replace(/[؀-ۿ‌]+/g, (w) => {
          const l = latinWord(w);
          return PROPER.get(l) || l;
        });
      })
      .join("");
    // sentence starts: the start of a paragraph or list item, and after . ! ?
    return out.replace(/(^|<p>|<li>|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }

  // Tappable follow-up questions inside an answer, in the asker's language
  const SUGGEST = {
    en: (area) => [
      `Is there power in ${area}?`,
      "Where is there no water?",
      "Any planned cuts?",
      "Latest news",
      "It's only my house",
      "How much is 500 kWh?",
    ],
    ckb: (area) => [
      `لە ${area} کارەبا هەیە؟`,
      "لە کوێ ئاو نییە؟",
      "بڕانی پلانکراو هەیە؟",
      "دوایین هەواڵەکان",
      "تەنها ماڵەکەم کارەبای نییە",
      "٥٠٠ کیلۆوات چەندە؟",
    ],
    ckbl: (area) => [
      `La ${area} karaba haya?`,
      "La kwe aw nya?",
      "Brrani plankraw haya?",
      "Hawali taza chiya?",
      "Tanha malakam karabay nya",
      "500 kwh chanda?",
    ],
    kmr: (area) => [
      `Li ${area} kehreba heye?`,
      "Li ku av tune?",
      "Qutbûnên plankirî hene?",
      "Nûçeyên dawî",
      "Tenê mala min",
      "500 kWh çiqas e?",
    ],
    ar: (area) => [
      `هل توجد كهرباء في ${area}؟`,
      "وين ماكو مي؟",
      "هل يوجد قطع مبرمج؟",
      "آخر الأخبار",
      "بيتي فقط بدون كهرباء",
      "كم سعر ٥٠٠ كيلوواط؟",
    ],
  };
  function suggestions(lang, n = 4) {
    const slug = lastArea ? lastArea.slug : EU.myArea() || "ankawa";
    const a = EU.area(slug);
    const list = SUGGEST[lang](EU.pick(a.name, lang === "ckbl" ? "en" : lang));
    return `<div class="msg__chips">${list
      .slice(0, n)
      .map((q) => `<button type="button" data-q="${EU.esc(q)}">${EU.esc(q)}</button>`)
      .join("")}</div>`;
  }

  function newsAnswer(lang) {
    const items = EU.NEWS.slice(0, 4)
      .map((n) => {
        const [y, m, d] = n.date.split("-");
        const date = EU.numIn(lang, Number(d)) + " " + EU.monthName(y + "-" + m, lang);
        const h = EU.headline(n, lang);
        const sep = lang === "ar" || lang === "ckb" ? "، " : ", ";
        return `<li><a href="${EU.esc(n.url)}" target="_blank" rel="noopener" lang="${h.lang}" dir="auto">${EU.esc(h.text)}</a><br><span class="small">${EU.esc([n.outlet, date, h.original ? EU.tIn(lang, "news.in." + h.original) : ""].filter(Boolean).join(sep))}</span><br>${EU.esc(EU.pick(n.sum, lang))}</li>`;
      })
      .join("");
    const planned = EU.Store.notices();
    return (
      `<p>${r(lang, "newsHead")}</p><ul>${items}</ul>` +
      (planned.length ? `<p>${r(lang, "plannedHead")}</p><ul>${noticeLines(lang, planned)}</ul>` : "") +
      `<p>${link("news.html", r(lang, "newsMore"))}</p>`
    );
  }

  function areasAnswer(lang) {
    const names = EU.AREAS.slice()
      .sort((a, b) => EU.pick(a.name, lang).localeCompare(EU.pick(b.name, lang)))
      .map((a) => link("area.html?a=" + encodeURIComponent(a.slug), EU.esc(EU.pick(a.name, lang))));
    return `<p>${r(lang, "areasHead", { n: nf(lang, EU.AREAS.length) })}</p><p>${names.join(sep(lang))}</p><p>${link("areas.html", r(lang, "areasLink"))}</p>`;
  }

  function contactAnswer(lang) {
    const T = EU.TEAM || {};
    let html = `<p>${r(lang, "contact", { hours: EU.esc(EU.pick(T.hours, lang) || "") })}</p>`;
    const phone = (T.electricity && T.electricity.phone) || (T.water && T.water.phone) || T.phone;
    if (phone)
      html += `<p>${r(lang, "contactPhone", { phone: `<a href="tel:${EU.esc(phone.replace(/[^\d+]/g, ""))}" dir="ltr">${EU.esc(phone)}</a>` })}</p>`;
    return html + `<p>${link("report.html", r(lang, "privateLink"))}</p>`;
  }

  // "EU-7J2AGX" in the question → open the tracking form with it filled in
  function trackRef(text) {
    const m = /\beu-?([a-z0-9]{6})\b/i.exec(text);
    return m ? "?ref=EU-" + m[1].toUpperCase() : "";
  }

  /* ------------------------------------------------------------------ *
   * Talking like a person: a few ways of saying the everyday things, so
   * it doesn't repeat itself word for word; a line that notices how
   * someone is feeling; and help for the hours a cut actually lasts.
   * ------------------------------------------------------------------ */
  const SAY = {
    greet: {
      en: [
        "Hi! Tell me your neighbourhood and I'll tell you what people are reporting there.",
        "Hello! Which part of Erbil are you in? I'll check the power and water for you.",
        "Hi there. Ask me about a neighbourhood, a planned cut, your bill, or a problem at home.",
      ],
      ckb: [
        "سڵاو! ناوی گەڕەکەکەت بڵێ، پێت دەڵێم خەڵک چی لەوێ ڕادەگەیەنن.",
        "سڵاو! لە کام بەشی هەولێریت؟ کارەبا و ئاوەکەت بۆ دەپشکنم.",
        "سڵاو. دەربارەی گەڕەکێک، بڕانێکی پلانکراو، پسوولەکەت یان کێشەیەک لە ماڵەوە بپرسە.",
      ],
      kmr: [
        "Silav! Navê taxa xwe bibêje, ez ê ji te re bibêjim mirov li wir çi radigihînin.",
        "Silav! Tu li kîjan beşê Hewlêrê yî? Ez ê li kehreb û avê binêrim.",
        "Silav. Li ser taxekê, qutbûneke plankirî, fatûreya xwe an pirsgirêkeke li malê bipirse.",
      ],
      ar: [
        "أهلًا! قل لي اسم حيّك وأخبرك بما يبلّغ عنه الناس هناك.",
        "مرحبًا! في أي منطقة من أربيل أنت؟ أشوف لك الكهرباء والماء.",
        "أهلًا بك. اسألني عن حي، أو قطع مجدول، أو فاتورتك، أو مشكلة في البيت.",
      ],
    },
    thanks: {
      en: [
        "You're welcome! If anything changes on your street, a quick report helps your neighbours.",
        "Any time. I hope it comes back soon.",
        "Glad that helped.",
      ],
      ckb: [
        "شایانی نییە! ئەگەر شتێک لە شەقامەکەت گۆڕا، ڕاپۆرتێکی خێرا یارمەتی دراوسێکانت دەدات.",
        "هەر کاتێک. هیوادارم زوو بگەڕێتەوە.",
        "خۆشحاڵم کە سوودی هەبوو.",
      ],
      kmr: [
        "Ser seran! Heke li kolana te tiştek biguhere, raporek bilez alîkariya cîranên te dike.",
        "Her dem. Hêvî dikim zû vegere.",
        "Kêfxweş im ku alîkar bû.",
      ],
      ar: [
        "العفو! إذا تغيّر شيء في شارعك، بلاغ سريع يساعد جيرانك.",
        "في أي وقت. أتمنى أن ترجع قريبًا.",
        "يسعدني أن هذا ساعد.",
      ],
    },
    unknown: {
      en: [
        "Sorry, I didn't catch that. Try something like:",
        "I'm not sure I follow. Could you put it another way? For example:",
        "I didn't understand that one. These are the kinds of things I know about:",
      ],
      ckb: [
        "ببورە، تێنەگەیشتم. شتێکی وەک ئەمانە تاقی بکەرەوە:",
        "دڵنیا نیم تێگەیشتبم. دەتوانیت بە شێوەیەکی تر بیڵێیت؟ بۆ نموونە:",
        "لەوە تێنەگەیشتم. ئەمانە ئەو شتانەن کە دەیانزانم:",
      ],
      kmr: [
        "Bibore, min fam nekir. Tiştekî wek van biceribîne:",
        "Ne bawer im ku min fêm kir. Tu dikarî bi awayekî din bibêjî? Mînak:",
        "Min ew fêm nekir. Ev ew tişt in ku ez pê dizanim:",
      ],
      ar: [
        "عذرًا، لم أفهم. جرّب شيئًا مثل:",
        "لست متأكدًا أنني فهمت. هل يمكنك قولها بطريقة أخرى؟ مثلًا:",
        "لم أفهم هذه. هذا النوع من الأشياء التي أعرفها:",
      ],
    },
    howareyou: {
      en: [
        "Good, thanks! Which neighbourhood are you in? I'll check the power and water there.",
        "I'm fine, thank you. How are things where you are? Is the power on?",
        "All good here. What's it like on your street today?",
      ],
      ckb: [
        "باشم، سوپاس! لە کام گەڕەکیت؟ کارەبا و ئاوی ئەوێت بۆ دەپشکنم.",
        "باشم، سوپاس. لای ئێوە چۆنە؟ کارەبا هەیە؟",
        "هەموو شتێک باشە. ئەمڕۆ لە شەقامەکەتان چۆنە؟",
      ],
      kmr: [
        "Baş im, spas! Tu li kîjan taxê yî? Ez ê li kehreba û ava wir binêrim.",
        "Ez baş im, spas. Li cem we çawa ye? Kehreb heye?",
        "Her tişt baş e. Îro li kolana we çawa ye?",
      ],
      ar: [
        "بخير، شكرًا! في أي حيّ أنت؟ أشوف لك الكهرباء والماء هناك.",
        "أنا بخير، شكرًا. كيف الوضع عندكم؟ الكهرباء موجودة؟",
        "كل شيء تمام. كيف الوضع في شارعكم اليوم؟",
      ],
    },
    bye: {
      en: ["Take care! Come back whenever the power or water plays up.", "Bye for now. I hope the lights stay on."],
      ckb: ["خوات لەگەڵ! هەر کاتێک کارەبا یان ئاو کێشەی هەبوو، وەرەوە.", "خوات لەگەڵ. هیوادارم کارەبا نەبڕێت."],
      kmr: [
        "Bi xatirê te! Kengî kehreba an av pirsgirêk derxist, dîsa were.",
        "Bi xatirê te. Hêvî dikim ronahî nebire.",
      ],
      ar: ["مع السلامة! ارجع متى ما صار عندك مشكلة بالكهرباء أو الماء.", "مع السلامة. أتمنى ما تنقطع الكهرباء."],
    },
  };
  const turns = {}; // which variant each reply is on
  // The next way of saying `key` in this language (round and round)
  function say(lang, key) {
    const list = SAY[key] && (SAY[key][lang] || SAY[key].en);
    if (!list) return r(lang, key);
    const n = (turns[key] = ((turns[key] ?? -1) + 1) % list.length);
    return list[n];
  }

  // A first line when someone sounds worn out, or someone at home is vulnerable
  const FEEL = {
    tired: {
      en: [
        "That sounds exhausting, especially in this heat.",
        "I'm sorry, that's a lot to put up with.",
        "That's really frustrating.",
      ],
      ckb: [
        "ئەمە زۆر ماندووکەرە، بەتایبەتی لەم گەرمایەدا.",
        "ببورە، ئەمە زۆرە بۆ بەرگەگرتن.",
        "ئەمە بەڕاستی بێزارکەرە.",
      ],
      kmr: [
        "Ev pir westîner e, bi taybetî di vê germê de.",
        "Bibore, ev pir zêde ye ku mirov ragire.",
        "Ev bi rastî aciz dike.",
      ],
      ar: ["هذا متعب جدًا، خصوصًا مع هذا الحر.", "آسف، هذا كثير على أي أحد.", "هذا مزعج فعلًا."],
    },
    care: {
      en: [
        "If someone at home depends on medicine that has to stay cold, or on a machine that needs power, tell the team: it can change how quickly they come.",
      ],
      ckb: [
        "ئەگەر کەسێک لە ماڵەوە پشت بە دەرمانێک دەبەستێت کە دەبێت سارد بمێنێتەوە، یان بە ئامێرێک کە کارەبای دەوێت، بە تیمەکە بڵێ: لەوانەیە خێرایی هاتنیان بگۆڕێت.",
      ],
      kmr: [
        "Heke kesek li malê bi dermanekî ku divê sar bimîne ve girêdayî be, an bi amûreke ku kehrebê dixwaze, ji tîmê re bêje: dibe ku zûbûna hatina wan biguherîne.",
      ],
      ar: [
        "إذا كان أحد في البيت يعتمد على دواء يجب أن يبقى باردًا، أو على جهاز يحتاج كهرباء، أخبر الفريق: قد يغيّر ذلك سرعة وصولهم.",
      ],
    },
  };
  function feel(lang, key) {
    const list = FEEL[key][lang] || FEEL[key].en;
    const n = (turns["feel." + key] = ((turns["feel." + key] ?? -1) + 1) % list.length);
    return list[n];
  }

  // Practical help for while it lasts. Kept to advice that's safe anywhere.
  const TIPS = {
    heat: {
      en: "<p>To get through a cut in the heat:</p><ul><li>Keep curtains and blinds closed during the day, and open windows only once it's cooler outside.</li><li>Drink water often, even if you're not thirsty, and check on older neighbours and small children.</li><li>A damp cloth on the neck and wrists cools you down quickly.</li></ul>",
      ckb: "<p>بۆ تێپەڕاندنی بڕانێک لە گەرمادا:</p><ul><li>بە ڕۆژ پەردەکان داخە، و تەنها کاتێک دەرەوە فێنکتر بوو پەنجەرەکان بکەرەوە.</li><li>زۆرجار ئاو بخۆرەوە، تەنانەت ئەگەر تینووت نەبێت، و سەردانی دراوسێ بەتەمەنەکان و منداڵە بچووکەکان بکە.</li><li>پەڕۆیەکی تەڕ لەسەر گەردن و مەچەک زوو فێنکت دەکاتەوە.</li></ul>",
      kmr: "<p>Ji bo derbaskirina qutbûnekê di germê de:</p><ul><li>Bi roj perdeyan girtî bihêle, û tenê gava derve hênik bû pencereyan veke.</li><li>Pir caran av vexwe, heta ku tu ne tî bî, û li cîranên temenmezin û zarokên piçûk binêre.</li><li>Pertalekî şil li ser stû û zendan te zû hênik dike.</li></ul>",
      ar: "<p>لتجاوز انقطاع في الحر:</p><ul><li>أبقِ الستائر مغلقة نهارًا، وافتح النوافذ فقط عندما يبرد الجو في الخارج.</li><li>اشرب الماء كثيرًا حتى لو لم تشعر بالعطش، وتفقّد الجيران كبار السن والأطفال الصغار.</li><li>قطعة قماش مبللة على الرقبة والمعصمين تبرّدك بسرعة.</li></ul>",
    },
    fridge: {
      en: "<p>Keep the fridge and freezer doors shut. A closed fridge keeps food cold for about 4 hours; a full freezer stays frozen for about 48 hours (24 if it's half full). After 4 hours without power, throw away meat, chicken, fish, milk and cooked food from the fridge. Food safety advice from the US Department of Agriculture.</p>",
      ckb: "<p>دەرگای سەلاجە و فریزەرەکە داخراو بهێڵەوە. سەلاجەیەکی داخراو نزیکەی ٤ کاتژمێر خواردن سارد دەهێڵێتەوە؛ فریزەرێکی پڕ نزیکەی ٤٨ کاتژمێر بەستوو دەمێنێتەوە (٢٤ ئەگەر نیوەپڕ بێت). دوای ٤ کاتژمێر بێ کارەبا، گۆشت، مریشک، ماسی، شیر و خواردنی لێنراو لە سەلاجەکە فڕێ بدە. ئامۆژگاری سەلامەتی خواردن لە وەزارەتی کشتوکاڵی ئەمریکاوە.</p>",
      kmr: "<p>Deriyên sarinc û cemidandinê girtî bihêle. Sarincek girtî xwarinê nêzîkî 4 saetan sar dihêle; cemidandineke tijî nêzîkî 48 saetan cemidî dimîne (24 heke nîvtijî be). Piştî 4 saetan bê kehreb, goşt, mirîşk, masî, şîr û xwarina pijandî ji sarincê bavêje. Şîreta ewlehiya xwarinê ji Wezareta Çandiniyê ya DYA.</p>",
      ar: "<p>أبقِ باب الثلاجة والفريزر مغلقًا. الثلاجة المغلقة تحافظ على برودة الطعام نحو ٤ ساعات، والفريزر الممتلئ يبقى متجمدًا نحو ٤٨ ساعة (٢٤ إذا كان نصف ممتلئ). بعد ٤ ساعات دون كهرباء، تخلّص من اللحم والدجاج والسمك والحليب والطعام المطبوخ في الثلاجة. نصيحة سلامة الغذاء من وزارة الزراعة الأمريكية.</p>",
    },
    save: {
      en: "<p>The biggest savings come from the air conditioner:</p><ul><li>Set it to 24–26 °C instead of as cold as it goes; each degree warmer uses noticeably less.</li><li>Clean the filters every couple of weeks in summer.</li><li>Keep doors and windows closed while it runs, and curtains drawn on sunny sides.</li><li>Don't leave the water heater on all day; heat water when you need it.</li></ul><p>Bills go up in steps, so the last kWh you use costs the most. The Runaki page shows the steps.</p>",
      ckb: "<p>گەورەترین پاشەکەوت لە سپلیتەوە دێت:</p><ul><li>لەسەر ٢٤–٢٦ پلەی دابنێ لەبری ساردترین؛ هەر پلەیەک گەرمتر بە ڕوونی کەمتر بەکاردەهێنێت.</li><li>لە هاویندا هەر دوو هەفتە جارێک فلتەرەکان پاک بکەرەوە.</li><li>کاتێک کار دەکات دەرگا و پەنجەرەکان داخراو بهێڵەوە، و پەردەی لای خۆرەکە داخە.</li><li>ئاوگەرمکەرەکە بە درێژایی ڕۆژ مەهێڵە؛ کاتێک پێویستت بوو ئاو گەرم بکە.</li></ul><p>پسوولەکان پلە بە پلە بەرز دەبنەوە، بۆیە دوایین کیلۆواتەکانت گرانترینن. پەڕەی ڕووناکی پلەکان پیشان دەدات.</p>",
      kmr: "<p>Teserûfa herî mezin ji klîmayê tê:</p><ul><li>Li ser 24–26 °C deyne li şûna herî sar; her pileyek germtir eşkere kêmtir bi kar tîne.</li><li>Di havînê de her du hefteyan carekê fîltreyan paqij bike.</li><li>Dema dixebite derî û pencereyan girtî bihêle, û perdeyên aliyê rojê bikişîne.</li><li>Germkera avê hemû rojê vekirî nehêle; gava hewce be avê germ bike.</li></ul><p>Fatûre gav bi gav bilind dibin, ji ber vê kWh-yên dawî yên herî biha ne. Rûpela Runakî gavan nîşan dide.</p>",
      ar: "<p>أكبر توفير يأتي من المكيف:</p><ul><li>اضبطه على ٢٤–٢٦ درجة بدل أبرد درجة؛ كل درجة أدفأ تستهلك أقل بشكل واضح.</li><li>نظّف الفلاتر كل أسبوعين تقريبًا في الصيف.</li><li>أبقِ الأبواب والنوافذ مغلقة أثناء تشغيله، والستائر مسدلة من جهة الشمس.</li><li>لا تترك سخان الماء شغالًا طوال اليوم؛ سخّن الماء عند الحاجة.</li></ul><p>الفاتورة ترتفع بشرائح، فآخر كيلوواط تستهلكه هو الأغلى. صفحة روناكي تعرض الشرائح.</p>",
    },
    tank: {
      en: "<p>For a water tank on the roof:</p><ul><li>Keep the lid on tight, so dust, insects and birds stay out.</li><li>Empty and scrub it a few times a year, and every time the water has been dirty.</li><li>A tank in full sun gets warm; shade or a cover keeps the water cooler and cleaner.</li><li>Boil tank water, or use bottled water, for drinking and for a baby's milk.</li></ul>",
      ckb: "<p>بۆ تانکی ئاوی سەربان:</p><ul><li>سەرەکەی توند داخە، بۆ ئەوەی تۆز، مێروو و باڵندە نەچنە ناوی.</li><li>چەند جارێک لە ساڵدا بەتاڵی بکەرەوە و بیشۆ، و هەموو جارێک کە ئاوەکە پیس بووە.</li><li>تانکێک لە بەر خۆری تەواودا گەرم دەبێت؛ سێبەر یان داپۆشەرێک ئاوەکە فێنکتر و پاکتر دەهێڵێتەوە.</li><li>بۆ خواردنەوە و شیری منداڵ ئاوی تانک بکوڵێنە، یان ئاوی بوتڵ بەکاربهێنە.</li></ul>",
      kmr: "<p>Ji bo tanka avê ya li ser banî:</p><ul><li>Qapaxê wê baş girtî bihêle, da ku toz, kêzik û çivîk nekevin hundir.</li><li>Salê çend caran vala bike û bişo, û her car ku av qirêj bûye.</li><li>Tankek di bin tava tije de germ dibe; sî an pêçek avê hênik û paqijtir dihêle.</li><li>Ji bo vexwarin û şîrê pitikê ava tankê bikelîne, an ava şûşeyê bi kar bîne.</li></ul>",
      ar: "<p>لخزان الماء على السطح:</p><ul><li>أبقِ الغطاء محكمًا حتى لا يدخله الغبار والحشرات والطيور.</li><li>أفرغه ونظّفه بالفرك بضع مرات في السنة، وفي كل مرة يكون الماء فيها متسخًا.</li><li>الخزان تحت الشمس الكاملة يسخن؛ الظل أو الغطاء يبقي الماء أبرد وأنظف.</li><li>اغلِ ماء الخزان أو استخدم المياه المعبأة للشرب ولحليب الطفل.</li></ul>",
    },
    clarify: {
      en: "Is it the power or the water?",
      ckb: "کارەبایە یان ئاو؟",
      kmr: "Kehreb e an av e?",
      ar: "الكهرباء أم الماء؟",
    },
  };
  const tip = (lang, key) => TIPS[key][lang] || TIPS[key].en;

  /* ------------------------------------------------------------------ *
   * Facts from official sources, for the questions people actually ask.
   * Each says where it comes from. Checked October 2026; when a source
   * changes, change the answer here and the date in its line.
   *   Runaki call centre, KYC, smart meters, overpayment: runaki.gov.krd/en/learn-more
   *   50-day payment rule: Ministry of Electricity, 15 July 2026
   *   Pre-Runaki debt discount: runaki.gov.krd (3 Aug – 10 Sep 2026)
   *   Erbil electricity numbers: gov.krd/moel-en/contact
   *   Water connection: service.gov.krd (General Directorates of Water and Sewage)
   *   Tanker prices: The New Arab and 964media, 2025
   * ------------------------------------------------------------------ */
  const FACTS = {
    callcentre: {
      en: '<p>The Runaki Call Centre is <b>1992</b>, every day from 9 am to midnight. It handles registering your home, bills, smart meters and old debt.</p><p>For faults in Erbil, the Ministry of Electricity lists its Erbil Cooperation Center: <a href="tel:07728500390" dir="ltr">0772 850 0390</a>, <a href="tel:07728500396" dir="ltr">0772 850 0396</a> or <a href="tel:07514903975" dir="ltr">0751 490 3975</a>.</p><p class="as__src">Sources: runaki.gov.krd and gov.krd, checked October 2026.</p>',
      ckb: '<p>سەنتەری پەیوەندیی ڕووناکی <b>١٩٩٢</b>ـە، هەموو ڕۆژێک لە ٩ی بەیانییەوە تا نیوەشەو. بۆ تۆمارکردنی ماڵەکەت، پسوولە، مێتەری زیرەک و قەرزی کۆن.</p><p>بۆ کێشەی کارەبا لە هەولێر، وەزارەتی کارەبا سەنتەری هاوکاریی هەولێر دانراوە: <a href="tel:07728500390" dir="ltr">0772 850 0390</a>، <a href="tel:07728500396" dir="ltr">0772 850 0396</a> یان <a href="tel:07514903975" dir="ltr">0751 490 3975</a>.</p><p class="as__src">سەرچاوە: runaki.gov.krd و gov.krd، تشرینی یەکەمی ٢٠٢٦.</p>',
      kmr: '<p>Navenda Pêwendiyê ya Runakî <b>1992</b> e, her roj ji 9ê sibê heta nîvê şevê. Ji bo tomarkirina mala te, fatûre, saetên jîr û deyna kevn.</p><p>Ji bo xeletiyên li Hewlêrê, Wezareta Kehrebê Navenda Hevkariyê ya Hewlêrê nîşan dide: <a href="tel:07728500390" dir="ltr">0772 850 0390</a>, <a href="tel:07728500396" dir="ltr">0772 850 0396</a> an <a href="tel:07514903975" dir="ltr">0751 490 3975</a>.</p><p class="as__src">Çavkanî: runaki.gov.krd û gov.krd, Cotmeh 2026.</p>',
      ar: '<p>مركز اتصال روناكي هو <b>١٩٩٢</b>، يوميًا من ٩ صباحًا حتى منتصف الليل. لتسجيل بيتك والفواتير والعدادات الذكية والديون القديمة.</p><p>لأعطال الكهرباء في أربيل، تذكر وزارة الكهرباء مركز التعاون في أربيل: <a href="tel:07728500390" dir="ltr">0772 850 0390</a> أو <a href="tel:07728500396" dir="ltr">0772 850 0396</a> أو <a href="tel:07514903975" dir="ltr">0751 490 3975</a>.</p><p class="as__src">المصدر: runaki.gov.krd و gov.krd، تشرين الأول ٢٠٢٦.</p>',
    },
    deadline: {
      en: '<p>A Runaki bill has to be paid within <b>50 days</b> of being issued on e-Psûle. After that the system disconnects the house automatically, and the power comes back within about 24 hours of paying everything owed. Registered homes get a text when a new bill is ready.</p><p class="as__src">Ministry of Electricity, 15 July 2026.</p>',
      ckb: '<p>پسوولەی ڕووناکی دەبێت لە ماوەی <b>٥٠ ڕۆژ</b> لە دەرچوونی لە ئی-پسوولە بدرێت. دوای ئەوە سیستەمەکە بە خۆکاری کارەبای ماڵەکە دەبڕێت، و نزیکەی ٢٤ کاتژمێر دوای دانی هەموو قەرزەکان دەگەڕێتەوە. ماڵە تۆمارکراوەکان کاتێک پسوولەی نوێ ئامادە بوو نامە وەردەگرن.</p><p class="as__src">وەزارەتی کارەبا، ١٥ی تەمموزی ٢٠٢٦.</p>',
      kmr: '<p>Fatûreya Runakî divê di nav <b>50 rojan</b> de ji derketina wê li e-Psûleyê were dayîn. Piştî wê sîstem bi xwe kehreba malê qut dike, û nêzîkî 24 saetan piştî dayîna hemû deynan vedigere. Malên tomarkirî gava fatûreyeke nû amade be peyamekê distînin.</p><p class="as__src">Wezareta Kehrebê, 15ê Tîrmeha 2026.</p>',
      ar: '<p>يجب دفع فاتورة روناكي خلال <b>٥٠ يومًا</b> من صدورها على إي-پسولە. بعد ذلك يفصل النظام الكهرباء عن البيت تلقائيًا، وتعود خلال نحو ٢٤ ساعة من دفع كل المستحقات. البيوت المسجلة تصلها رسالة عند صدور فاتورة جديدة.</p><p class="as__src">وزارة الكهرباء، ١٥ تموز ٢٠٢٦.</p>',
    },
    olddebt: {
      en: '<p>The discount of up to 50% on old, pre-Runaki debt (50% for homes, 25% for businesses) ran from 3 August to 10 September 2026, paid through e-Psûle. It has ended. The Ministry says old debts will also be cut off automatically when unpaid, so it\'s worth settling them on e-Psûle or at a commercial office. Questions: call 1992.</p><p class="as__src">runaki.gov.krd, 2026.</p>',
      ckb: '<p>داشکاندنی تا ٥٠٪ لەسەر قەرزی کۆنی پێش ڕووناکی (٥٠٪ بۆ ماڵ، ٢٥٪ بۆ بازرگانی) لە ٣ی ئابەوە تا ١٠ی ئەیلوولی ٢٠٢٦ بوو، بە ئی-پسوولە. کۆتایی هاتووە. وەزارەت دەڵێت قەرزی کۆنیش ئەگەر نەدرێت بە خۆکاری دەبڕدرێت، بۆیە باشترە لە ئی-پسوولە یان نووسینگەی بازرگانی بیدەیت. پرسیار: ١٩٩٢.</p><p class="as__src">runaki.gov.krd، ٢٠٢٦.</p>',
      kmr: '<p>Daxistina heta 50% li ser deyna kevn a berî Runakî (50% ji bo malan, 25% ji bo karsaziyan) ji 3ê Tebaxê heta 10ê Îlona 2026 bû, bi e-Psûleyê. Ew qediya. Wezaret dibêje deynên kevn jî heke neyên dayîn bi xwe tên qutkirin, ji ber vê baş e ku li e-Psûleyê an nivîsgeheke bazirganî bidî. Pirs: 1992.</p><p class="as__src">runaki.gov.krd, 2026.</p>',
      ar: '<p>خصم حتى ٥٠٪ على الديون القديمة قبل روناكي (٥٠٪ للبيوت، ٢٥٪ للتجاري) كان من ٣ آب إلى ١٠ أيلول ٢٠٢٦ عبر إي-پسولە، وقد انتهى. تقول الوزارة إن الديون القديمة غير المدفوعة ستُفصل تلقائيًا أيضًا، لذا الأفضل تسديدها عبر إي-پسولە أو في المكتب التجاري. للاستفسار: ١٩٩٢.</p><p class="as__src">runaki.gov.krd، ٢٠٢٦.</p>',
    },
    register: {
      en: '<p>Registering your home with Runaki takes under 3 minutes: scan the QR code on your blue bill, use “Submit your info” on runaki.gov.krd, call <b>1992</b>, or go to a commercial office. It links your phone to the home, so you get texts about bills, use and maintenance cuts. A new owner or tenant should register the home in their own name. No bill? If you know the account number, use it with a photo of the bill; if not, a photo of the meter; otherwise take your Block ID to a commercial office.</p><p class="as__src">runaki.gov.krd, checked October 2026.</p>',
      ckb: '<p>تۆمارکردنی ماڵەکەت لە ڕووناکی کەمتر لە ٣ خولەکی دەوێت: کۆدی QR لەسەر پسوولە شینەکەت بخوێنەرەوە، «زانیارییەکانت بنێرە» لە runaki.gov.krd بەکاربهێنە، پەیوەندی بە <b>١٩٩٢</b> بکە، یان بڕۆ بۆ نووسینگەی بازرگانی. ژمارەی مۆبایلەکەت بە ماڵەکەوە دەبەستێتەوە، بۆ ئەوەی نامە دەربارەی پسوولە، بەکارهێنان و بڕانی چاککردنەوە وەربگریت. خاوەنی نوێ یان کرێچی دەبێت بە ناوی خۆی تۆماری بکات. پسوولەت نییە؟ ئەگەر ژمارەی هەژمارەکەت دەزانیت لەگەڵ وێنەی پسوولە، ئەگەر نا وێنەی مێتەرەکە، دەنا ناسنامەی بلۆکەکەت ببە بۆ نووسینگەی بازرگانی.</p><p class="as__src">runaki.gov.krd، تشرینی یەکەمی ٢٠٢٦.</p>',
      kmr: '<p>Tomarkirina mala te li Runakî ji 3 deqeyan kêmtir dixwaze: koda QR ya li ser fatûreya te ya şîn bixwîne, «Agahiyên xwe bişîne» li runaki.gov.krd bi kar bîne, li <b>1992</b> bigere, an here nivîsgeheke bazirganî. Ew telefona te bi malê ve girê dide, da ku peyaman li ser fatûre, bikaranîn û qutbûnên lênêrînê bistînî. Xwedî an kirêdarê nû divê bi navê xwe tomar bike. Fatûre tune? Heke hejmara hesabê dizanî bi wêneyê fatûreyê, heke na wêneyê saetê, an jî nasnameya blokê bibe nivîsgeheke bazirganî.</p><p class="as__src">runaki.gov.krd, Cotmeh 2026.</p>',
      ar: '<p>تسجيل بيتك في روناكي يستغرق أقل من ٣ دقائق: امسح رمز QR على فاتورتك الزرقاء، أو استخدم «أرسل معلوماتك» على runaki.gov.krd، أو اتصل بـ<b>١٩٩٢</b>، أو اذهب إلى المكتب التجاري. يربط رقم هاتفك بالبيت لتصلك رسائل عن الفواتير والاستهلاك وقطوع الصيانة. المالك أو المستأجر الجديد يسجّل البيت باسمه. ليس عندك فاتورة؟ إذا كنت تعرف رقم الحساب فمع صورة الفاتورة، وإلا فصورة العداد، أو خذ هوية البلوك إلى المكتب التجاري.</p><p class="as__src">runaki.gov.krd، تشرين الأول ٢٠٢٦.</p>',
    },
    meter: {
      en: "<p>The smart meter is free (the government pays for it). It records what you use; if your old meter worked properly, your bill shouldn't change much, and it doesn't limit your supply. If your area has already been done, you can book a visit, which usually happens within 5 to 10 working days. Call 1992.</p><p class=\"as__src\">runaki.gov.krd, checked October 2026.</p>",
      ckb: '<p>مێتەری زیرەک بێبەرامبەرە (حکومەت تێچووەکەی دەدات). ئەوەی بەکاری دەهێنیت تۆمار دەکات؛ ئەگەر مێتەرە کۆنەکەت بە دروستی کاری دەکرد، پسوولەکەت زۆر ناگۆڕێت، و کارەباکەت سنووردار ناکات. ئەگەر ناوچەکەت تەواو بووە، دەتوانیت کاتێک دابنێیت، زۆرجار لە ٥ تا ١٠ ڕۆژی کاردا دێن. پەیوەندی بە ١٩٩٢ بکە.</p><p class="as__src">runaki.gov.krd، تشرینی یەکەمی ٢٠٢٦.</p>',
      kmr: '<p>Saeta jîr belaş e (hikûmet dide). Ew tiştê ku tu bi kar tînî tomar dike; heke saeta te ya kevn rast dixebitî, fatûreya te pir naguhere, û ew kehreba te sînordar nake. Heke herêma te hatibe qedandin, tu dikarî serdanekê veqetînî, bi gelemperî di nav 5 heta 10 rojên kar de. Li 1992 bigere.</p><p class="as__src">runaki.gov.krd, Cotmeh 2026.</p>',
      ar: '<p>العداد الذكي مجاني (تتحمل الحكومة كلفته). يسجّل ما تستهلكه؛ إذا كان عدادك القديم يعمل جيدًا فلن تتغير فاتورتك كثيرًا، ولا يحدّ من الكهرباء. إذا انتهى التركيب في منطقتك يمكنك حجز زيارة، وعادة تتم خلال ٥ إلى ١٠ أيام عمل. اتصل بـ١٩٩٢.</p><p class="as__src">runaki.gov.krd، تشرين الأول ٢٠٢٦.</p>',
    },
    overpaid: {
      en: '<p>Money paid by mistake isn\'t refunded: it stays on your account and goes towards old debt or your next bills. If you missed the bill collector, pay online with e-Psûle, or at a commercial office.</p><p class="as__src">runaki.gov.krd, checked October 2026.</p>',
      ckb: '<p>پارەی بە هەڵە دراو ناگەڕێندرێتەوە: لەسەر هەژمارەکەت دەمێنێتەوە و بۆ قەرزی کۆن یان پسوولەکانی داهاتوو دەچێت. ئەگەر پارەکۆکەرەوەکەت لەدەست چوو، بە ئی-پسوولە یان لە نووسینگەی بازرگانی بیدە.</p><p class="as__src">runaki.gov.krd، تشرینی یەکەمی ٢٠٢٦.</p>',
      kmr: '<p>Pereyê bi xeletî hatî dayîn nayê vegerandin: li ser hesabê te dimîne û ji bo deyna kevn an fatûreyên bê diçe. Heke berhevkarê fatûreyê te winda kir, bi e-Psûleyê an li nivîsgeheke bazirganî bide.</p><p class="as__src">runaki.gov.krd, Cotmeh 2026.</p>',
      ar: '<p>المبلغ المدفوع بالخطأ لا يُسترد: يبقى في حسابك ويُخصم من الديون القديمة أو الفواتير القادمة. إذا فاتك الجابي، ادفع عبر إي-پسولە أو في المكتب التجاري.</p><p class="as__src">runaki.gov.krd، تشرين الأول ٢٠٢٦.</p>',
    },
    runakiwhen: {
      en: '<p>Homes registered with Runaki get a text when their area switches to 24-hour power. The KRG\'s aim is the whole Kurdistan Region by the end of 2026. In July 2025 a member of the Iraqi parliament asked the Federal Supreme Court to cancel the decision behind Runaki; the programme has carried on since.</p><p class="as__src">runaki.gov.krd; Peregraf, July 2025.</p>',
      ckb: '<p>ماڵە تۆمارکراوەکان لە ڕووناکی کاتێک ناوچەکەیان دەگۆڕێت بۆ کارەبای ٢٤ کاتژمێری نامە وەردەگرن. ئامانجی حکومەتی هەرێم هەموو هەرێمی کوردستانە تا کۆتایی ٢٠٢٦. لە تەمموزی ٢٠٢٥ ئەندامێکی پەرلەمانی عێراق داوای لە دادگای باڵای فیدراڵی کرد بڕیاری ڕووناکی هەڵبوەشێنێتەوە؛ پڕۆگرامەکە لەو کاتەوە بەردەوامە.</p><p class="as__src">runaki.gov.krd؛ پەرەگراف، تەمموزی ٢٠٢٥.</p>',
      kmr: '<p>Malên li Runakî tomarkirî gava herêma wan derbasî kehreba 24 saetan dibe peyamekê distînin. Armanca HKR hemû Herêma Kurdistanê ye heta dawiya 2026. Di Tîrmeha 2025 de endamekî parlamentoya Iraqê ji Dadgeha Bilind a Federal xwest ku biryara Runakî betal bike; bername ji wê demê ve berdewam e.</p><p class="as__src">runaki.gov.krd; Peregraf, Tîrmeh 2025.</p>',
      ar: '<p>البيوت المسجلة في روناكي تصلها رسالة عندما تتحول منطقتها إلى كهرباء ٢٤ ساعة. هدف حكومة الإقليم هو كامل إقليم كوردستان بحلول نهاية ٢٠٢٦. في تموز ٢٠٢٥ طلب نائب في البرلمان العراقي من المحكمة الاتحادية العليا إلغاء القرار الخاص بروناكي، واستمر البرنامج منذ ذلك الحين.</p><p class="as__src">runaki.gov.krd؛ بيرەگراف، تموز ٢٠٢٥.</p>',
    },
    tanker: {
      en: "<p>When the mains don't come, many households buy tanker water. In 2025 reports put a 1,500-litre load at about 25,000 IQD, and residents of Saidawa paid 45,000–50,000 IQD a load during that summer's shortage. Prices rise in summer. Report the shortage here so the team sees how many streets have no water, and if it has gone on for days, tell them directly.</p><p class=\"as__src\">The New Arab and 964media, 2025.</p>",
      ckb: '<p>کاتێک ئاوی تۆڕەکە نایەت، زۆر ماڵ ئاوی تانکەر دەکڕن. لە ٢٠٢٥ ڕاپۆرتەکان باری ١٥٠٠ لیترییان بە نزیکەی ٢٥،٠٠٠ دینار دانا، و خەڵکی سەیداوە لەو هاوینەدا ٤٥،٠٠٠–٥٠،٠٠٠ دینار بۆ هەر بارێک دەیاندا. لە هاویندا نرخ بەرز دەبێتەوە. کەمئاوییەکە لێرە ڕاپۆرت بکە بۆ ئەوەی تیمەکە ببینێت چەند شەقام ئاویان نییە، و ئەگەر چەند ڕۆژە بەردەوامە، ڕاستەوخۆ پێیان بڵێ.</p><p class="as__src">The New Arab و 964media، ٢٠٢٥.</p>',
      kmr: '<p>Gava ava torê nayê, gelek mal ava tankerê dikirin. Di 2025an de raporan bareke 1.500 lîtreyî bi nêzîkî 25.000 dînar dan, û niştecihên Seydawayê di wê havînê de ji bo her barekê 45.000–50.000 dînar didan. Di havînê de biha bilind dibin. Kêmbûna avê li vir ragihîne da ku tîm bibîne çend kolan bê av in, û heke çend roj e berdewam e, rasterast ji wan re bêje.</p><p class="as__src">The New Arab û 964media, 2025.</p>',
      ar: '<p>عندما لا يأتي ماء الشبكة، تشتري بيوت كثيرة ماء الصهاريج. في ٢٠٢٥ ذكرت التقارير أن حمولة ١٥٠٠ لتر بنحو ٢٥٬٠٠٠ دينار، ودفع سكان سيداوە ٤٥٬٠٠٠–٥٠٬٠٠٠ دينار للحمولة خلال أزمة ذلك الصيف. ترتفع الأسعار في الصيف. بلّغ عن الشح هنا ليرى الفريق كم شارعًا بلا ماء، وإن استمر أيامًا فأخبرهم مباشرة.</p><p class="as__src">The New Arab و964media، ٢٠٢٥.</p>',
    },
    waterconnect: {
      en: '<p>A new mains water connection: apply at the Revenue unit of your Directorate of Water and Sewerage. Bring the land or building permit, the construction permit, the owner\'s ID and residence card. An inspection team visits, you pay the fee (8,500 IQD for a home, 13,000 for a business) and the meter is assigned. Offices are open 8:30 to 15:00; in Erbil the General Directorate of Water is on Rasti Street, near Furqan Mosque.</p><p class="as__src">service.gov.krd, checked October 2026.</p>',
      ckb: '<p>بەستنەوەی نوێی ئاوی تۆڕ: داواکاری لە یەکەی داهاتی بەڕێوەبەرایەتیی ئاو و ئاوەڕۆی ناوچەکەت پێشکەش بکە. مۆڵەتی زەوی یان بینا، مۆڵەتی بیناسازی، ناسنامە و کارتی نیشتەجێبوونی خاوەنەکە بهێنە. تیمێکی پشکنین سەردان دەکات، کرێکە دەدەیت (٨٬٥٠٠ دینار بۆ ماڵ، ١٣٬٠٠٠ بۆ بازرگانی) و مێتەرەکە دیاری دەکرێت. نووسینگەکان لە ٨:٣٠ تا ١٥:٠٠ کراوەن؛ لە هەولێر بەڕێوەبەرایەتیی گشتیی ئاو لە شەقامی ڕاستی، نزیک مزگەوتی فورقانە.</p><p class="as__src">service.gov.krd، تشرینی یەکەمی ٢٠٢٦.</p>',
      kmr: '<p>Girêdaneke nû ya ava torê: serlêdanê li yekeya dahatê ya Rêveberiya Av û Kanalîzasyonê ya herêma xwe bike. Destûra erd an avahiyê, destûra avakirinê, nasname û karta niştecihbûnê ya xwedî bîne. Tîmek kontrolê serdan dike, tu xercê didî (8.500 dînar ji bo malê, 13.000 ji bo karsaziyê) û saet tê diyarkirin. Nivîsgeh ji 8:30 heta 15:00 vekirî ne; li Hewlêrê Rêveberiya Giştî ya Avê li Kolana Rastî ye, nêzîkî Mizgefta Furqanê.</p><p class="as__src">service.gov.krd, Cotmeh 2026.</p>',
      ar: '<p>اشتراك جديد بماء الشبكة: قدّم الطلب في وحدة الإيرادات في مديرية الماء والمجاري في منطقتك. أحضر إجازة الأرض أو البناء وإجازة البناء وهوية المالك وبطاقة السكن. يزور فريق كشف، ثم تدفع الرسم (٨٬٥٠٠ دينار للسكني و١٣٬٠٠٠ للتجاري) ويُخصّص العداد. الدوام من ٨:٣٠ إلى ١٥:٠٠؛ في أربيل المديرية العامة للماء في شارع راستي قرب جامع الفرقان.</p><p class="as__src">service.gov.krd، تشرين الأول ٢٠٢٦.</p>',
    },
  };
  const fact = (lang, key) => FACTS[key][lang] || FACTS[key].en;

  /* ------------------------------------------------------------------ *
   * Step-by-step help. Each step says something and offers a few
   * answers; an answer leads to another step, or to an action:
   *   private  send a private request (one house, a call back)
   *   report   report it on the map, so neighbours and the team see it
   *   person   talk to the team in this chat
   * The first option is the "yes" one and the second the "no" one, so a
   * typed "yes" / "na" / "بەڵێ" / "لا" works as well as a tap.
   * ------------------------------------------------------------------ */
  const FLOW_TEXT = {
    // only my house has no power
    "pw.ask": {
      en: "If it's only your house, the fault is usually at your meter or inside the house, not in the street. Do your neighbours have power right now?",
      ckb: "ئەگەر تەنها ماڵی ئێوەیە، کێشەکە زۆربەی جار لە مێتەرەکەت یان ناو ماڵەکەیە، نەک لە شەقامەکە. ئێستا دراوسێکانت کارەبایان هەیە؟",
      kmr: "Heke tenê mala we be, xeletî bi gelemperî li saeta te an hundirê malê ye, ne li kolanê. Niha cîranên te kehreb heye?",
      ar: "إذا كان بيتك فقط، فالعطل غالبًا في المقياس أو داخل البيت، لا في الشارع. هل عند جيرانك كهرباء الآن؟",
    },
    "pw.box": {
      en: "Look at your meter box. Is the main switch (the breaker) down, or has a fuse gone?",
      ckb: "سەیری سندوقی مێتەرەکەت بکە. سویچە سەرەکییەکە (قاتعەکە) دابەزیوە، یان فیوزێک سووتاوە؟",
      kmr: "Li qutiya saetê binêre. Şaltera sereke ketiye, an sîgorteyek şewitiye?",
      ar: "انظر إلى صندوق المقياس. هل القاطع الرئيسي نازل، أو احترق فيوز؟",
    },
    "pw.meter": {
      en: "Then it may be the meter or the cable to your house, which only the team can check. Send a private request and they'll call you to arrange a visit, or talk to them here.",
      ckb: "کەواتە لەوانەیە مێتەرەکە یان کێبڵی ماڵەکەت بێت، کە تەنها تیمەکە دەتوانێت بیپشکنێت. داواکارییەکی تایبەت بنێرە و پەیوەندیت پێوە دەکەن بۆ ڕێکخستنی سەردانێک، یان لێرە قسەیان لەگەڵ بکە.",
      kmr: "Wê demê dibe ku saet an kabloya mala te be, ku tenê tîm dikare kontrol bike. Daxwazeke taybet bişîne û ew ê li te bigerin ji bo serdanekê, an li vir bi wan re biaxive.",
      ar: "قد يكون إذن المقياس أو الكابل الواصل لبيتك، وهذا يفحصه الفريق فقط. أرسل طلبًا خاصًا وسيتصلون بك لترتيب زيارة، أو تحدث معهم هنا.",
    },
    "pw.street": {
      en: "Then it's more than your house. Report it on the map: the more neighbours who report, the sooner it's confirmed and the team sees it.",
      ckb: "کەواتە لە ماڵەکەت زیاترە. لەسەر نەخشەکە ڕاپۆرتی بکە: هەتا دراوسێی زیاتر ڕاپۆرت بکەن، زووتر پشتڕاست دەبێتەوە و تیمەکە دەیبینێت.",
      kmr: "Wê demê ji mala te zêdetir e. Li ser nexşeyê ragihîne: çiqas cîran zêdetir ragihînin, ew zûtir tê piştrastkirin û tîm dibîne.",
      ar: "إذن المشكلة أكبر من بيتك. بلّغ عنها على الخريطة: كلما بلّغ جيران أكثر، تأكدت أسرع ورآها الفريق.",
    },
    // the breaker keeps tripping
    "br.reset": {
      en: "Switch off the big things first: air conditioner, water heater, heater and oven. Then push the main switch back up once. Did it stay on?",
      ckb: "سەرەتا شتە گەورەکان بکوژێنەوە: سپلیت، ئاوگەرمکەر، سۆبە و فڕن. پاشان یەک جار سویچە سەرەکییەکە بەرز بکەرەوە. مایەوە؟",
      kmr: "Pêşî tiştên mezin vemirîne: klîma, germkera avê, sobe û firne. Paşê carekê şaltera sereke rake. Ma vêketî ma?",
      ar: "أطفئ الأجهزة الكبيرة أولًا: المكيف وسخان الماء والمدفأة والفرن. ثم ارفع القاطع الرئيسي مرة واحدة. هل بقي شغالًا؟",
    },
    "br.ok": {
      en: "Good. Turn the big appliances back on one at a time. If it trips when one of them comes on, that appliance has a fault or is too much for your line, so leave it off until it's been checked.",
      ckb: "باشە. ئامێرە گەورەکان یەک یەک هەڵبکەرەوە. ئەگەر کاتێک یەکێکیان هەڵدەکرێت دەپەڕێت، ئەو ئامێرە کێشەی هەیە یان بۆ هێڵەکەت زۆرە، بۆیە بیکوژێنەوە تا دەپشکنرێت.",
      kmr: "Baş e. Amûrên mezin yek bi yek vêxe. Heke dema yek ji wan vedibe dikeve, ew amûr xera ye an ji bo xeta te zêde ye, ji ber vê vemirandî bihêle heta ku were kontrolkirin.",
      ar: "جيد. شغّل الأجهزة الكبيرة واحدًا واحدًا. إذا فصل القاطع عند تشغيل أحدها، فهذا الجهاز معطل أو أكبر من خطك، فاتركه مطفأً حتى يُفحص.",
    },
    "br.stop": {
      en: "Don't keep resetting it. A switch that trips straight away is protecting you from a fault. Leave it off, and if you smell burning or see scorch marks, keep everyone away from the box. The team or an electrician needs to look at it.",
      ckb: "بەردەوام هەڵی مەکەرەوە. سویچێک کە یەکسەر دەپەڕێت لە کێشەیەک دەتپارێزێت. با کوژاوە بێت، و ئەگەر بۆنی سووتانت کرد یان شوێنی سووتانت بینی، هەمووان لە سندوقەکە دوور بخەرەوە. پێویستە تیمەکە یان وەستایەک سەیری بکات.",
      kmr: "Berdewam venexe. Şalterek ku di cih de dikeve te ji xeletiyekê diparêze. Vemirandî bihêle, û heke bêhna şewatê bê an şopên şewitînê bibînî, herkesî ji qutiyê dûr bixe. Divê tîm an hostayek lê binêre.",
      ar: "لا تكرر رفعه. القاطع الذي يفصل فورًا يحميك من عطل. اتركه مطفأً، وإذا شممت رائحة احتراق أو رأيت آثار حرق فأبعد الجميع عن الصندوق. يجب أن يفحصه الفريق أو كهربائي.",
    },
    // lights flickering, voltage jumping
    "fl.ask": {
      en: "While the voltage is jumping, protect your appliances: unplug the TV, computer and fridge, and switch off the air conditioner until it's steady. Is it the whole street, or only your house?",
      ckb: "تا فۆڵتیەکە کەم و زۆر دەکات، ئامێرەکانت بپارێزە: تەلەفزیۆن، کۆمپیوتەر و سەلاجەکە لە پلاک دەربهێنە، و سپلیتەکە بکوژێنەوە تا جێگیر دەبێت. هەموو شەقامەکەیە یان تەنها ماڵی ئێوە؟",
      kmr: "Heta ku voltaj diçe û tê, amûrên xwe biparêze: TV, komputer û sarincê ji prîzê derxe, û klîmayê vemirîne heta ku aram bibe. Hemû kolan e, an tenê mala we?",
      ar: "ما دامت الفولتية تتذبذب، احمِ أجهزتك: افصل التلفزيون والحاسوب والثلاجة، وأطفئ المكيف حتى تستقر. هل هو الشارع كله أم بيتك فقط؟",
    },
    "fl.street": {
      en: "Report it as “Weak or jumping voltage” so the team can see how many houses it reaches.",
      ckb: "وەک «فۆڵتیەی لاواز یان ناجێگیر» ڕاپۆرتی بکە بۆ ئەوەی تیمەکە ببینێت چەند ماڵ دەگرێتەوە.",
      kmr: "Wek «Voltaja qels an diçe û tê» ragihîne da ku tîm bibîne çend malan digire.",
      ar: "بلّغ عنها كـ«فولتية ضعيفة أو متذبذبة» حتى يرى الفريق كم بيتًا تشمل.",
    },
    "fl.home": {
      en: "In one house, flickering often comes from a loose connection. If a socket or switch feels warm, buzzes or smells of burning, stop using it. Have the team or an electrician check it.",
      ckb: "لە یەک ماڵدا، لەرزینی گڵۆپ زۆرجار لە پەیوەندییەکی شل دێت. ئەگەر پلاکێک یان سویچێک گەرمە، دەنگ دەدات یان بۆنی سووتان دەدات، بەکاری مەهێنە. با تیمەکە یان وەستایەک بیپشکنێت.",
      kmr: "Di yek malê de, lerizîna ronahiyê bi gelemperî ji girêdaneke sist tê. Heke prîzek an şalterek germ e, deng dike an bêhna şewatê dide, bi kar neyne. Bila tîm an hostayek kontrol bike.",
      ar: "في بيت واحد، يأتي الرمش غالبًا من توصيلة مرتخية. إذا كان مقبس أو مفتاح دافئًا أو يطنّ أو له رائحة احتراق، توقف عن استخدامه. دع الفريق أو كهربائيًا يفحصه.",
    },
    // weak water pressure
    "wp.ask": {
      en: "Do your neighbours have weak water too?",
      ckb: "دراوسێکانیشت ئاویان لاوازە؟",
      kmr: "Ma ava cîranên te jî qels e?",
      ar: "هل ماء جيرانك ضعيف أيضًا؟",
    },
    "wp.area": {
      en: "Then it's the area. In many parts of Erbil water comes at set hours, so it can be weak outside your area's turn. Report it as “Weak pressure” so the team can see how far it goes.",
      ckb: "کەواتە ناوچەکەیە. لە زۆر شوێنی هەولێر ئاو لە کاتی دیاریکراودا دێت، بۆیە لە دەرەوەی نۆرەی ناوچەکەت لەوانەیە لاواز بێت. وەک «فشاری لاواز» ڕاپۆرتی بکە بۆ ئەوەی تیمەکە ببینێت تا کوێ دەگات.",
      kmr: "Wê demê herêm e. Li gelek deverên Hewlêrê av di saetên diyarkirî de tê, ji ber vê derveyî dora herêma te dibe qels be. Wek «Zexta qels» ragihîne da ku tîm bibîne heta ku derê diçe.",
      ar: "إذن هي المنطقة. في أجزاء كثيرة من أربيل يأتي الماء في ساعات محددة، فقد يكون ضعيفًا خارج دور منطقتك. بلّغ عنه كـ«ضغط ضعيف» حتى يرى الفريق إلى أين يمتد.",
    },
    "wp.home": {
      en: "Check the main valve next to your water meter is fully open. If you have a pump or a roof tank, check the tank's float valve isn't stuck. If it's still weak, the team can check the line to your house.",
      ckb: "دڵنیابە کە سەمامە سەرەکییەکەی تەنیشت مێتەری ئاوەکەت بە تەواوی کراوەتەوە. ئەگەر پەمپ یان تانکی سەربانت هەیە، دڵنیابە کە عەوامەی تانکەکە گیری نەخواردووە. ئەگەر هێشتا لاوازە، تیمەکە دەتوانێت هێڵی ماڵەکەت بپشکنێت.",
      kmr: "Kontrol bike ku zengila sereke li kêleka saeta avê bi temamî vekirî ye. Heke pompe an tanka banî heye, kontrol bike ku avbenda tankê asê nebûye. Heke hîn qels be, tîm dikare xeta mala te kontrol bike.",
      ar: "تأكد أن المحبس الرئيسي بجانب عداد الماء مفتوح بالكامل. إذا عندك مضخة أو خزان على السطح، تأكد أن عوامة الخزان غير عالقة. إذا بقي ضعيفًا، يمكن للفريق فحص الخط الواصل لبيتك.",
    },
    // no water, only at my house
    "wm.ask": {
      en: "Do your neighbours have water right now?",
      ckb: "ئێستا دراوسێکانت ئاویان هەیە؟",
      kmr: "Niha cîranên te av heye?",
      ar: "هل عند جيرانك ماء الآن؟",
    },
    "wm.home": {
      en: "Then it's probably the valve or the pipe to your house. Check the main valve by the meter is open. If it is, send a private request so the team can check your line.",
      ckb: "کەواتە بەگومانی زۆر سەمامەکە یان بۆرییەکەی ماڵەکەتە. دڵنیابە کە سەمامە سەرەکییەکەی لای مێتەرەکە کراوەیە. ئەگەر کراوەیە، داواکارییەکی تایبەت بنێرە بۆ ئەوەی تیمەکە هێڵەکەت بپشکنێت.",
      kmr: "Wê demê dibe ku zengil an boriya mala te be. Kontrol bike ku zengila sereke li ba saetê vekirî ye. Heke vekirî be, daxwazeke taybet bişîne da ku tîm xeta te kontrol bike.",
      ar: "إذن غالبًا المحبس أو الأنبوب الواصل لبيتك. تأكد أن المحبس الرئيسي عند العداد مفتوح. إذا كان مفتوحًا، أرسل طلبًا خاصًا ليفحص الفريق خطك.",
    },
    "wm.area": {
      en: "Then it's the area. Check the neighbourhood page for a planned cut, and if there isn't one, report it so the team sees it.",
      ckb: "کەواتە ناوچەکەیە. لە پەڕەی گەڕەکەکە سەیری بڕانی پلانکراو بکە، و ئەگەر نەبوو، ڕاپۆرتی بکە بۆ ئەوەی تیمەکە ببینێت.",
      kmr: "Wê demê herêm e. Li rûpela taxê li qutbûneke plankirî binêre, û heke tune be, ragihîne da ku tîm bibîne.",
      ar: "إذن هي المنطقة. راجع صفحة الحي بحثًا عن قطع مجدول، وإن لم يوجد فبلّغ عنه ليراه الفريق.",
    },
    // dirty water
    "dw.run": {
      en: "Don't drink it or use it for cooking or a baby's milk. Let the cold tap run for a few minutes. Is it clear now?",
      ckb: "مەیخۆرەوە و بۆ چێشت لێنان یان شیری منداڵ بەکاری مەهێنە. با بۆری ئاوی سارد چەند خولەکێک بڕوات. ئێستا ڕوون بووەتەوە؟",
      kmr: "Venexwe û ji bo xwarinê an şîrê pitikê bi kar neyne. Bila lûleya ava sar çend deqeyan biherike. Niha zelal bûye?",
      ar: "لا تشربه ولا تستخدمه للطبخ أو لحليب الطفل. اترك حنفية الماء البارد تجري بضع دقائق. هل صار صافيًا الآن؟",
    },
    "dw.clear": {
      en: "Good. If it comes back, report it so the team can check the pipes in your area.",
      ckb: "باشە. ئەگەر گەڕایەوە، ڕاپۆرتی بکە بۆ ئەوەی تیمەکە بۆرییەکانی ناوچەکەت بپشکنێت.",
      kmr: "Baş e. Heke dîsa vegere, ragihîne da ku tîm boriyên herêma te kontrol bike.",
      ar: "جيد. إذا عاد، بلّغ عنه ليفحص الفريق الأنابيب في منطقتك.",
    },
    "dw.still": {
      en: "Keep to bottled water for drinking and cooking. Report it as “Dirty, coloured or smelly water”: if neighbours report the same, the team will know it's the network.",
      ckb: "بۆ خواردنەوە و چێشت لێنان ئاوی بوتڵ بەکاربهێنە. وەک «ئاوی پیس، ڕەنگاوڕەنگ یان بۆنخۆش نەبوو» ڕاپۆرتی بکە: ئەگەر دراوسێکانیش هەمان شت ڕاپۆرت بکەن، تیمەکە دەزانێت تۆڕەکەیە.",
      kmr: "Ji bo vexwarin û xwarinê ava şûşeyê bi kar bîne. Wek «Ava qirêj, rengîn an bi bêhn» ragihîne: heke cîran jî heman tiştî ragihînin, tîm dê bizane ku tor e.",
      ar: "استخدم المياه المعبأة للشرب والطبخ. بلّغ عنه كـ«ماء متسخ أو ملوّن أو له رائحة»: إذا بلّغ الجيران عن الشيء نفسه، سيعرف الفريق أنها الشبكة.",
    },
  };
  const OPT = {
    yesThey: { en: "Yes, they do", ckb: "بەڵێ، هەیانە", kmr: "Erê, heye", ar: "نعم، عندهم" },
    noThey: { en: "No, they don't either", ckb: "نەخێر، ئەوانیش نییانە", kmr: "Na, ew jî tune", ar: "لا، وهم أيضًا" },
    dontKnow: { en: "I don't know", ckb: "نازانم", kmr: "Nizanim", ar: "لا أعرف" },
    yesDown: { en: "Yes, it's down", ckb: "بەڵێ، دابەزیوە", kmr: "Erê, ketiye", ar: "نعم، نازل" },
    noNormal: { en: "No, it looks normal", ckb: "نەخێر، ئاساییە", kmr: "Na, normal xuya dike", ar: "لا، يبدو طبيعيًا" },
    stayed: { en: "Yes, it stayed on", ckb: "بەڵێ، مایەوە", kmr: "Erê, ma", ar: "نعم، بقي شغالًا" },
    trips: { en: "No, it trips again", ckb: "نەخێر، دیسان دەپەڕێت", kmr: "Na, dîsa dikeve", ar: "لا، يفصل مجددًا" },
    street: { en: "The whole street", ckb: "هەموو شەقامەکە", kmr: "Hemû kolan", ar: "الشارع كله" },
    mine: { en: "Only my house", ckb: "تەنها ماڵی ئێمە", kmr: "Tenê mala me", ar: "بيتي فقط" },
    weakToo: {
      en: "Yes, theirs is weak too",
      ckb: "بەڵێ، ئەوانیش لاوازە",
      kmr: "Erê, ya wan jî qels e",
      ar: "نعم، ضعيف عندهم أيضًا",
    },
    onlyUs: { en: "No, only ours", ckb: "نەخێر، تەنها هی ئێمە", kmr: "Na, tenê ya me", ar: "لا، عندنا فقط" },
    clear: { en: "Yes, it's clear", ckb: "بەڵێ، ڕوونە", kmr: "Erê, zelal e", ar: "نعم، صافٍ" },
    stillDirty: { en: "No, still dirty", ckb: "نەخێر، هێشتا پیسە", kmr: "Na, hîn qirêj e", ar: "لا، ما زال متسخًا" },
    private: {
      en: "Send a private request",
      ckb: "داواکارییەکی تایبەت بنێرە",
      kmr: "Daxwazeke taybet bişîne",
      ar: "أرسل طلبًا خاصًا",
    },
    report: { en: "Report it", ckb: "ڕاپۆرتی بکە", kmr: "Ragihîne", ar: "بلّغ عنه" },
    person: { en: "Talk to the team", ckb: "قسە لەگەڵ تیمەکە بکە", kmr: "Bi tîmê re biaxive", ar: "تحدث مع الفريق" },
  };
  // name → { service, start, steps: { id: [text key, [[option, next step or action], ...]] } }
  const FLOWS = {
    noPower: {
      service: "electricity",
      start: "ask",
      steps: {
        ask: [
          "pw.ask",
          [
            ["yesThey", "box"],
            ["noThey", "street"],
            ["dontKnow", "box"],
          ],
        ],
        box: [
          "pw.box",
          [
            ["yesDown", "flow:breaker"],
            ["noNormal", "meter"],
          ],
        ],
        meter: [
          "pw.meter",
          [
            ["private", "@private"],
            ["person", "@person"],
          ],
        ],
        street: ["pw.street", [["report", "@report"]]],
      },
    },
    breaker: {
      service: "electricity",
      start: "reset",
      steps: {
        reset: [
          "br.reset",
          [
            ["stayed", "ok"],
            ["trips", "stop"],
          ],
        ],
        ok: ["br.ok", []],
        stop: [
          "br.stop",
          [
            ["private", "@private"],
            ["person", "@person"],
          ],
        ],
      },
    },
    flicker: {
      service: "electricity",
      start: "ask",
      steps: {
        ask: [
          "fl.ask",
          [
            ["street", "street"],
            ["mine", "home"],
          ],
        ],
        street: ["fl.street", [["report", "@report"]]],
        home: [
          "fl.home",
          [
            ["private", "@private"],
            ["person", "@person"],
          ],
        ],
      },
    },
    pressure: {
      service: "water",
      start: "ask",
      steps: {
        ask: [
          "wp.ask",
          [
            ["weakToo", "area"],
            ["onlyUs", "home"],
          ],
        ],
        area: ["wp.area", [["report", "@report"]]],
        home: [
          "wp.home",
          [
            ["private", "@private"],
            ["person", "@person"],
          ],
        ],
      },
    },
    noWater: {
      service: "water",
      start: "ask",
      steps: {
        ask: [
          "wm.ask",
          [
            ["yesThey", "home"],
            ["noThey", "area"],
          ],
        ],
        home: [
          "wm.home",
          [
            ["private", "@private"],
            ["person", "@person"],
          ],
        ],
        area: ["wm.area", [["report", "@report"]]],
      },
    },
    dirty: {
      service: "water",
      start: "run",
      steps: {
        run: [
          "dw.run",
          [
            ["clear", "clear"],
            ["stillDirty", "still"],
          ],
        ],
        clear: ["dw.clear", []],
        still: [
          "dw.still",
          [
            ["report", "@report"],
            ["person", "@person"],
          ],
        ],
      },
    },
  };
  let flow = null; // { name, step, lang } while a flow waits for an answer

  // One step of a flow, with its answer buttons. Sets `flow` while it waits.
  function flowHtml(name, stepId, outLang) {
    const L = outLang === "ckb-Latn" ? "ckb" : outLang;
    const f = FLOWS[name];
    const [key, opts] = f.steps[stepId];
    const pick = (o) => EU.esc(o[L] || o.en);
    const a = lastArea ? "a=" + encodeURIComponent(lastArea.slug) + "&" : "";
    const buttons = opts.map(([label, next], i) => {
      if (next === "@private") return link("report.html" + (a ? "?" + a.slice(0, -1) : ""), pick(OPT.private));
      if (next === "@report") return link("report.html?" + a + "s=" + f.service, pick(OPT.report));
      if (next === "@person")
        return `<button type="button" class="btn btn--small" data-talk="${f.service}" data-reason="asked" data-lang="${L}">${pick(OPT.person)}</button>`;
      return `<button type="button" class="btn btn--small btn--quiet" data-flow="${name}:${stepId}:${i}">${pick(OPT[label])}</button>`;
    });
    flow = opts.some(([, next]) => !next.startsWith("@")) ? { name, step: stepId, lang: outLang } : null;
    return `<p>${pick(FLOW_TEXT[key])}</p>${buttons.length ? `<p class="as__choices">${buttons.join("")}</p>` : ""}`;
  }

  // The visitor picked answer `i` (tapped, or typed yes / no)
  function flowNext(name, stepId, i) {
    const f = FLOWS[name];
    const step = f && f.steps[stepId];
    const opt = step && step[1][i];
    if (!opt || opt[1].startsWith("@")) return null;
    const outLang = flow && flow.name === name ? flow.lang : talkLang(pickedLang() || EU.lang);
    const L = outLang === "ckb-Latn" ? "ckb" : outLang;
    const [label, next] = opt;
    const html = next.startsWith("flow:")
      ? flowHtml(next.slice(5), FLOWS[next.slice(5)].start, outLang)
      : flowHtml(name, next, outLang);
    lastIntent = "flow";
    return {
      said: OPT[label][L] || OPT[label].en,
      html: outLang === "ckb-Latn" ? latinize(html) : html,
      lang: outLang,
    };
  }

  // "When will it come back?" Honest: a time only when the team gave one.
  function etaAnswer(lang, area, svc) {
    if (!area) return `<p>${r(lang, "etaWhere")}</p>`;
    const name = EU.esc(EU.pick(area.name, lang));
    const cut = EU.Store.notices(area.slug, svc).find((n) => n.now);
    if (cut) return `<p>${r(lang, "etaPlanned", { area: name, time: EU.clock(cut.to, lang) })}</p>`;
    const st = EU.Store.areaStatus(area.slug);
    const open = (svc ? [st[svc]] : [st.electricity, st.water]).some((s) => s.open.length);
    return `<p>${r(lang, open ? "etaUnknown" : "etaNothing", { area: name })}</p><p>${link("area.html?a=" + encodeURIComponent(area.slug), r(lang, "openArea", { area: name }))}</p>`;
  }

  // "Why?" about the last answer
  function whyAnswer(lang) {
    if (lastIntent === "area" && lastArea) {
      const st = EU.Store.areaStatus(lastArea.slug);
      if (st.electricity.state === "unconfirmed" || st.water.state === "unconfirmed")
        return `<p>${r(lang, "whyUnconfirmed")}</p>`;
      if (st.electricity.state === "none" && st.water.state === "none") return `<p>${r(lang, "whyNone")}</p>`;
    }
    if (lastIntent === "planned") return `<p>${r(lang, "whyPlanned")}</p>`;
    return `<p>${r(lang, "whyGeneral")}</p>`;
  }

  /* The rules, in order; the first that fits answers. Each has a name, so
     the tests can check what was understood, not just the wording.
     c = { lang, asked, text, area (named now), here (named now or before), svc } */
  const RULES = [
    [
      "flow",
      (q) => flow && q.toks.length <= 4 && (q.yes || q.no),
      (q) => {
        const n = flowNext(flow.name, flow.step, q.yes ? 0 : 1);
        return n ? n.html : "";
      },
    ],
    [
      "danger",
      (q) => q.danger,
      (q, c) => `<p>${r(c.lang, "danger")}</p><p>${link("report.html", r(c.lang, "reportLink"))}</p>`,
    ],
    ["human", (q, c) => q.human && !c.area, (q, c) => `<p>${r(c.lang, "human")}</p>`],
    ["fridge", (q) => q.fridge && !q.flicker && !q.breaker, (q, c) => tip(c.lang, "fridge")],
    [
      "heat",
      (q) => q.heat && (q.out || q.power || q.eta || q.toks.length <= 8),
      (q, c) => tip(c.lang, "heat") + tip(c.lang, "fridge"),
    ],
    ["save", (q) => q.save, (q, c) => tip(c.lang, "save") + `<p>${link("runaki.html", r(c.lang, "billLink"))}</p>`],
    ["tank", (q) => q.tank && !q.tanker, (q, c) => tip(c.lang, "tank")],
    ["callcentre", (q) => q.callcentre || (q.contact && q.runaki), (q, c) => fact(c.lang, "callcentre")],
    ["deadline", (q) => q.deadline || (q.cutoff && (q.bill || q.pay || q.power)), (q, c) => fact(c.lang, "deadline")],
    ["olddebt", (q) => q.olddebt, (q, c) => fact(c.lang, "olddebt")],
    ["register", (q) => q.register && !q.report, (q, c) => fact(c.lang, "register")],
    ["meter", (q) => q.meter && !q.water && !q.breaker && !q.out, (q, c) => fact(c.lang, "meter")],
    ["overpaid", (q) => q.overpaid, (q, c) => fact(c.lang, "overpaid")],
    ["runakiwhen", (q) => q.runakiwhen || (q.runaki && (q.eta || q.cancel)), (q, c) => fact(c.lang, "runakiwhen")],
    ["tanker", (q) => q.tanker, (q, c) => fact(c.lang, "tanker")],
    ["waterconnect", (q) => q.connect && q.water, (q, c) => fact(c.lang, "waterconnect")],
    ["breaker", (q) => q.breaker, (q, c) => flowHtml("breaker", "reset", c.out)],
    ["flicker", (q) => q.flicker && !q.water, (q, c) => flowHtml("flicker", "ask", c.out)],
    ["noPowerHome", (q) => q.private && !q.water && (q.out || q.power), (q, c) => flowHtml("noPower", "ask", c.out)],
    ["pressure", (q) => q.water && q.weak, (q, c) => flowHtml("pressure", "ask", c.out)],
    ["noWaterHome", (q) => q.private && q.water, (q, c) => flowHtml("noWater", "ask", c.out)],
    ["dirty", (q) => q.dirty, (q, c) => flowHtml("dirty", "run", c.out)],
    ["eta", (q) => q.eta && !q.planned && !q.bill, (q, c) => etaAnswer(c.lang, c.here, c.svc)],
    ["why", (q) => q.why && q.toks.length <= 6, (q, c) => whyAnswer(c.lang)],
    ["fixed", (q, c) => q.fixed && c.here && q.toks.length <= 6, (q, c) => areaAnswer(c.lang, c.here, q)],
    ["smalltalk", (q, c) => q.howareyou && !c.topic, (q, c) => c.own("howareyou")],
    ["areas", (q, c) => q.areasList && !q.power && !q.water && !q.out && !c.area, (q, c) => areasAnswer(c.lang)],
    [
      "planned",
      (q) => q.planned && !q.bill,
      (q, c) => plannedAnswer(c.lang, c.area || (lastIntent === "planned" ? lastArea : null), q),
    ],
    // "what about Gulan?" after a question about planned cuts
    [
      "planned",
      (q, c) => c.area && q.toks.length <= 4 && lastIntent === "planned",
      (q, c) => plannedAnswer(c.lang, c.area, q),
    ],
    [
      "track",
      (q) => q.track,
      (q, c) =>
        `<p>${r(c.lang, "track")}</p><p>${link("report.html" + trackRef(c.text) + "#track", r(c.lang, "trackLink"))}</p>`,
    ],
    [
      "alerts",
      (q) => q.alerts && !q.bill,
      (q, c) =>
        `<p>${r(c.lang, "alerts")}</p>${c.here ? `<p>${link("area.html?a=" + encodeURIComponent(c.here.slug), r(c.lang, "openArea", { area: EU.esc(EU.pick(c.here.name, c.lang)) }))}</p>` : ""}`,
    ],
    [
      "photo",
      (q, c) => q.photo && !c.area,
      (q, c) => `<p>${r(c.lang, "photo")}</p><p>${link("report.html", r(c.lang, "reportLink"))}</p>`,
    ],
    ["news", (q) => q.news, (q, c) => newsAnswer(c.lang)],
    [
      "private",
      (q) => q.private && !q.where,
      (q, c) => `<p>${r(c.lang, "private")}</p><p>${link("report.html", r(c.lang, "privateLink"))}</p>`,
    ],
    ["contact", (q, c) => q.contact && !c.area, (q, c) => contactAnswer(c.lang)],
    [
      "report",
      (q, c) => q.report && !c.area && !q.where && q.number == null,
      (q, c) => `<p>${r(c.lang, "report")}</p><p>${link("report.html", r(c.lang, "reportLink"))}</p>`,
    ],
    [
      "pay",
      (q, c) => q.pay && !c.area && q.number == null,
      (q, c) =>
        `<p>${r(c.lang, "pay")}</p><p><a href="${EU.LINKS.epsule}" target="_blank" rel="noopener">${r(c.lang, "payLink")}</a></p>`,
    ],
    [
      "generator",
      (q, c) => q.generator && !c.area && q.number == null,
      (q, c) => `<p>${r(c.lang, "generator")}</p><p>${link("runaki.html", r(c.lang, "billLink"))}</p>`,
    ],
    ["bill", (q, c) => q.bill && !c.area, (q, c) => billAnswer(c.lang, q.number)],
    [
      "quality",
      (q, c) => q.quality && !c.area,
      (q, c) => `<p>${r(c.lang, "quality")}</p><p>${link("report.html?s=water", r(c.lang, "reportLink"))}</p>`,
    ],
    ["runaki", (q) => q.runaki && !q.out, (q, c) => runakiAnswer(c.lang, c.area)],
    [
      "generator",
      (q, c) => q.generator && !c.area,
      (q, c) => `<p>${r(c.lang, "generator")}</p><p>${link("runaki.html", r(c.lang, "billLink"))}</p>`,
    ],
    ["area", (q, c) => c.area, (q, c) => areaAnswer(c.lang, c.area, q)],
    [
      "outages",
      (q) => q.where || ((q.power || q.water) && q.out),
      (q, c) => (lastArea && !q.where ? areaAnswer(c.lang, lastArea, q) : listAnswer(c.lang, q)),
    ],
    ["area", (q) => (q.power || q.water) && lastArea, (q, c) => areaAnswer(c.lang, lastArea, q)],
    ["areas", (q) => q.areasList, (q, c) => areasAnswer(c.lang)],
    ["whichArea", (q) => q.power || q.water, (q, c) => `<p>${r(c.lang, "whichArea")}</p>${suggestions(c.asked, 3)}`],
    // "nothing works", "it's off again": ask which, with two buttons that ask again
    [
      "clarify",
      (q) => q.out && !q.power && !q.water && q.toks.length <= 7,
      (q, c) =>
        `<p>${EU.esc(TIPS.clarify[c.lang] || TIPS.clarify.en)}</p><p class="as__choices">${["electricity", "water"].map((sv) => `<button type="button" class="btn btn--small btn--quiet" data-q="${EU.esc(c.text + " " + EU.tIn(c.lang, "svc." + sv))}">${tt(c.lang, "svc." + sv)}</button>`).join("")}</p>`,
    ],
    [
      "trust",
      (q) => q.trust,
      (q, c) => `<p>${r(c.lang, "colours")}</p><p>${EU.esc(EU.tIn(c.lang, "about.trust1"))}</p>`,
    ],
    [
      "privacy",
      (q) => q.privacy,
      (q, c) => `<p>${EU.esc(EU.tIn(c.lang, "about.privacy1"))}</p><p>${EU.esc(EU.tIn(c.lang, "about.privacy2"))}</p>`,
    ],
    ["map", (q) => q.map, (q, c) => `<p>${r(c.lang, "mapAbout")}</p><p>${link("map.html", r(c.lang, "seeMap"))}</p>`],
    ["language", (q) => q.language, (q, c) => `<p>${r(c.lang, "language")}</p>`],
    ["offline", (q) => q.offline, (q, c) => `<p>${r(c.lang, "offline")}</p>`],
    ["whoami", (q) => q.whoami, (q, c) => c.own("whoami")],
    ["about", (q) => q.about, (q, c) => `<p>${r(c.lang, "about")}</p>`],
    ["insult", (q) => q.insult, (q, c) => c.own("insult", suggestions(c.asked))],
    ["smalltalk", (q) => q.howareyou, (q, c) => c.own("howareyou")],
    ["bye", (q) => q.bye, (q, c) => c.own("bye")],
    ["thanks", (q) => q.thanks, (q, c) => c.own("thanks")],
    ["greet", (q) => q.greet, (q, c) => c.own("greet", suggestions(c.asked))],
    ["help", (q) => q.help, (q, c) => r(c.lang, "help") + suggestions(c.asked)],
    ["bill", (q) => q.number != null && q.number >= 50, (q, c) => billAnswer(c.lang, q.number)],
    ["yesno", (q) => q.yesno, (q, c) => c.own("yesno", suggestions(c.asked))],
  ];

  function answer(text) {
    const q = understand(text);
    // A bare "no" / "لا" during step-by-step help stays in that conversation's language
    const keep = flow && q.toks.length <= 4 && (q.yes || q.no) ? flow.lang : null;
    const asked = keep ? (keep === "ckb-Latn" ? "ckbl" : keep) : pickedLang() || detectLang(text);
    const latin = asked === "ckbl";
    const lang = latin ? "ckb" : asked; // Sorani in Latin: build in Sorani, convert at the end
    const outLang = latin ? "ckb-Latn" : lang;
    const area = q.areas[0] || null;
    if (area) lastArea = area;
    const service = q.water && !q.power ? "water" : q.power && !q.water ? "electricity" : null;
    if (service) lastService = service;

    let ready = false; // ready: already Latin, don't convert
    // small talk has hand-written Sorani-in-Latin replies
    const own = (key, extra = "") => {
      if (latin && R[key].ckbl) {
        ready = true;
        return `<p>${R[key].ckbl}</p>${extra}`;
      }
      return `<p>${SAY[key] ? say(lang, key) : r(lang, key)}</p>${extra}`;
    };
    const c = {
      lang,
      asked,
      text,
      out: outLang,
      own,
      area,
      here: area || lastArea,
      svc: service || lastService,
      topic: area || q.power || q.water || q.bill || q.pay || q.report || q.news || q.planned || q.private || q.runaki,
    };

    const waiting = flow;
    let intent = "unknown",
      html = "";
    for (const [name, test, build] of RULES) {
      if (test(q, c)) {
        intent = name;
        html = build(q, c);
        break;
      }
    }
    if (intent === "unknown") html = own(q.toks.length <= 2 ? "guess" : "unknown", suggestions(asked));
    if (intent === "flow") ready = outLang === "ckb-Latn"; // flowNext converted it already
    // a new question ends a step-by-step that was waiting for an answer
    if (waiting && flow === waiting && intent !== "flow") flow = null;
    misses = intent === "unknown" ? misses + 1 : 0;
    if (intent !== "why") lastIntent = intent;

    // Someone worn out, or someone vulnerable at home: say so before the answer
    if (q.care) html = `<p>${EU.esc(feel(lang, "care"))}</p>` + html;
    else if (q.tired && intent !== "insult") html = `<p>${EU.esc(feel(lang, "tired"))}</p>` + html;

    // "slaw, la ankawa karaba haya?": answer the question, say hello first
    if ((q.greet || q.howareyou) && area) html = `<p>${latin ? "Slaw!" : r(lang, "hello")}</p>` + html;

    /* When to offer a real person: something dangerous, a problem that has
       gone on for days, they ask for one, or we've failed them twice. */
    let offer = null;
    if (q.danger) offer = { reason: "danger", service: c.svc || "electricity" };
    else if (q.human) offer = { reason: "asked", service: c.svc };
    else if (
      q.long &&
      (q.out || q.power || q.water || q.dirty || q.quality) &&
      !(q.olddebt || q.deadline || q.bill || q.pay)
    )
      offer = { reason: "long", service: c.svc };
    else if (q.care && (q.out || q.power || q.water || q.fridge))
      offer = { reason: "long", service: c.svc || "electricity" };
    else if (q.frustrated || misses >= 2) offer = { reason: "stuck", service: c.svc };

    if (latin && !ready) {
      // the suggestion buttons are already in Latin letters
      const cut = html.indexOf('<div class="msg__chips">');
      html = cut < 0 ? latinize(html) : latinize(html.slice(0, cut)) + html.slice(cut);
    }
    return { lang: outLang, html, offer, intent };
  }

  /* ------------------------------------------------------------------ *
   * Chat panel. Opened from the "Ask" button in the header, or from the
   * question box on the home page.
   * ------------------------------------------------------------------ */
  let panel,
    log,
    input,
    chips,
    lastOpener,
    started = false;
  const said = []; // what the visitor typed, for handing over to the team

  /* The answer language. "Automatic" follows whatever they write in. */
  const LANG_KEY = "eu.as.lang";
  function pickedLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      return EU.LANGS.includes(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function pickLang(v) {
    try {
      if (v) localStorage.setItem(LANG_KEY, v);
      else localStorage.removeItem(LANG_KEY);
    } catch (e) {
      /* this visit only */
    }
  }
  const rtl = (l) => l === "ckb" || l === "ar";
  const talkLang = (l) => (l === "ckb-Latn" ? "ckb" : EU.LANGS.includes(l) ? l : EU.lang);

  function build() {
    panel = document.createElement("section");
    panel.className = "as";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "as-title");
    panel.innerHTML = `
      <div class="as__head">
        <div class="as__titles">
          <h2 id="as-title" data-i18n="as.title"></h2>
          <p class="as__sub" id="as-sub" hidden></p>
        </div>
        <label class="as__lang"><span class="sr-only" data-i18n="as.answerIn"></span>
          <select id="as-lang">
            <option value="" data-i18n="as.langAuto"></option>
            <option value="en" lang="en">English</option>
            <option value="ckb" lang="ckb">کوردی</option>
            <option value="kmr" lang="kmr">Kurdî</option>
            <option value="ar" lang="ar">عربي</option>
          </select></label>
        <button type="button" class="as__end" id="as-end" hidden data-i18n="as.chat.end"></button>
        <button type="button" class="as__close" data-i18n-attr="aria-label:as.close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="as__log" aria-live="polite"></div>
      <div class="as__chips"></div>
      <form class="as__form">
        <label class="sr-only" for="as-input" data-i18n="as.placeholder"></label>
        <input id="as-input" type="text" autocomplete="off" maxlength="300" dir="auto" data-i18n-attr="placeholder:as.placeholder">
        <button type="submit" data-i18n-attr="aria-label:as.send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </form>`;
    document.body.append(panel);
    log = panel.querySelector(".as__log");
    input = panel.querySelector("input");
    chips = panel.querySelector(".as__chips");
    EU.apply(panel);

    const langPick = panel.querySelector("#as-lang");
    langPick.value = pickedLang() || "";
    langPick.addEventListener("change", () => pickLang(langPick.value || null));

    document.querySelectorAll("[data-ask]").forEach((b) => b.addEventListener("click", () => open()));
    panel.querySelector(".as__close").addEventListener("click", close);
    panel.querySelector("#as-end").addEventListener("click", endChat);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) close();
    });
    panel.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (chat) sendChat(input.value);
      else ask(input.value);
    });
    log.addEventListener("click", (e) => {
      const b = e.target.closest("[data-q]");
      if (b) ask(b.getAttribute("data-q"));
      const step = e.target.closest("[data-flow]");
      if (step) {
        const [name, id, i] = step.getAttribute("data-flow").split(":");
        const next = flowNext(name, id, Number(i));
        if (next) {
          step.closest(".as__choices").remove();
          bubble("msg--me", EU.esc(next.said));
          reply(next.html, next.lang);
        }
      }
      const talk = e.target.closest("[data-talk]");
      if (talk)
        startChat(
          talk.getAttribute("data-talk"),
          talk.getAttribute("data-reason"),
          talk.getAttribute("data-lang"),
          talk,
        );
    });
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) ask(b.textContent);
    });
    EU.onLang(() => {
      if (!log.querySelector(".msg")) renderChips();
      const intro = log.querySelector(".as__intro");
      if (intro) intro.textContent = EU.t("as.intro");
      if (chat) chatHead();
    });
    resumeChat();
  }

  function renderChips() {
    chips.innerHTML = chat
      ? ""
      : ["as.s1", "as.s2", "as.s3", "as.s4"].map((k) => `<button type="button">${EU.esc(EU.t(k))}</button>`).join("");
  }

  function begin() {
    if (started) return;
    started = true;
    const intro = document.createElement("p");
    intro.className = "as__intro";
    intro.textContent = EU.t("as.intro");
    log.appendChild(intro);
    renderChips();
  }

  function open(question) {
    lastOpener = document.activeElement;
    panel.hidden = false;
    document.body.classList.add("has-panel");
    document.querySelectorAll("[data-ask]").forEach((b) => b.setAttribute("aria-expanded", "true"));
    begin();
    if (question) ask(question);
    input.focus();
    log.scrollTop = log.scrollHeight;
  }

  function close() {
    panel.hidden = true;
    document.body.classList.remove("has-panel");
    document.querySelectorAll("[data-ask]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    if (lastOpener && lastOpener.focus) lastOpener.focus();
  }

  // One entry in the conversation, labelled "You", "Assistant" or the team
  // member's name, in the language it's written in
  function bubble(cls, html, lang, who) {
    const div = document.createElement("div");
    div.className = "msg " + cls;
    const l = lang && lang !== "ckb-Latn" ? lang : EU.lang;
    div.setAttribute(
      "data-who",
      who || EU.tIn(EU.LANGS.includes(l) ? l : "en", cls === "msg--me" ? "as.you" : "as.name"),
    );
    if (lang) {
      div.lang = lang;
      div.dir = rtl(lang) ? "rtl" : "ltr";
    } else {
      div.dir = "auto";
    }
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // A quiet line in the middle: "You're now talking to the water team"
  function note(text, lang) {
    const p = document.createElement("p");
    p.className = "as__note";
    if (lang) {
      p.lang = lang;
      p.dir = rtl(lang) ? "rtl" : "ltr";
    }
    p.innerHTML = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function ask(text) {
    text = String(text || "")
      .trim()
      .slice(0, 300);
    if (!text) return;
    input.value = "";
    said.push(text);
    bubble("msg--me", EU.esc(text));
    chips.innerHTML = "";
    const { lang, html, offer } = answer(text);
    reply(html, lang, () => {
      if (offer && !chat) offerPerson(offer, talkLang(lang));
    });
  }

  /* An answer arrives the way a person types one: "Writing…" for a moment
     (longer answers take a little longer, never a full second), then the
     paragraphs appear one after another. Instant with "reduce motion". */
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pending = Promise.resolve();
  function reply(html, lang, then) {
    pending = pending.then(
      () =>
        new Promise((done) => {
          if (still) {
            bubble("msg--bot", html, lang);
            if (then) then();
            done();
            return;
          }
          const L = talkLang(lang);
          const div = bubble("msg--bot", `<p class="as__writing">${EU.esc(EU.tIn(L, "as.writing"))}</p>`, lang);
          const words = html
            .replace(/<[^>]+>/g, " ")
            .trim()
            .split(/\s+/).length;
          setTimeout(
            () => {
              div.innerHTML = html;
              [...div.children].forEach((el, i) => {
                el.classList.add("as__in");
                el.style.animationDelay = i * 120 + "ms";
              });
              log.scrollTop = log.scrollHeight;
              if (then) then();
              done();
            },
            Math.min(850, 260 + words * 9),
          );
        }),
    );
  }

  /* ------------------------------------------------------------------ *
   * Talking to a real person. The assistant offers it; the chat goes to
   * the team page of that service, and their replies come back here live.
   * ------------------------------------------------------------------ */
  let chat = null; // { ref, service, status, lang, lastId }
  let chatLive = null;
  let waitTimer = null;

  const tl = (lang, key, params) => EU.esc(EU.tIn(lang, key, params));
  const team = (lang, service) => EU.tIn(lang, "as.team." + service);

  async function call(url, body) {
    let res;
    try {
      res = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "x-requested-with": "fetch", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("offline");
    }
    const out = await res.json().catch(() => ({ ok: false, reason: "server" }));
    if (!out.ok) throw new Error(out.reason || "server");
    return out;
  }

  async function offerPerson(offer, lang) {
    const services = offer.service ? [offer.service] : ["electricity", "water"];
    const box = note(
      `<span>${tl(lang, "as.offer." + offer.reason, { team: team(lang, services[0]) })}</span>
      <span class="as__presence"></span>
      <span class="as__offer">${services.map((sv) => `<button type="button" class="btn btn--small" data-talk="${sv}" data-reason="${offer.reason}" data-lang="${lang}">${tl(lang, "as.talkTo", { team: team(lang, sv) })}</button>`).join("")}</span>`,
      lang,
    );
    box.classList.add("as__note--offer");
    // Say honestly whether anyone is there right now
    try {
      const states = await Promise.all(services.map((sv) => call("/api/chats/online?service=" + sv)));
      box.querySelector(".as__presence").textContent = EU.tIn(
        lang,
        states.some((x) => x.online) ? "as.online" : "as.notOnline",
      );
    } catch (e) {
      box.querySelector(".as__presence").remove();
    }
  }

  async function startChat(service, reason, lang, button) {
    if (chat) return;
    button.disabled = true;
    const asked = said.slice(-4);
    try {
      const res = await call("/api/chats", {
        service,
        reason,
        lang,
        area: lastArea ? lastArea.slug : null,
        message: asked[asked.length - 1] || EU.tIn(lang, "as.chat.hello"),
        context: asked.slice(0, -1).join(" · "),
      });
      log.querySelectorAll("[data-talk]").forEach((b) => b.closest(".as__offer").remove());
      enterChat(res.chat, { fresh: true });
    } catch (err) {
      button.disabled = false;
      note(tl(lang, err.message === "slowDown" ? "as.chat.busy" : "as.chat.err"), lang);
    }
  }

  function chatHead() {
    const sub = panel.querySelector("#as-sub");
    const L = chat.lang;
    sub.hidden = false;
    sub.lang = L;
    sub.textContent =
      chat.status === "waiting"
        ? EU.tIn(L, "as.chat.waiting", { team: team(L, chat.service) })
        : EU.tIn(L, "as.chat.answering", { name: chat.answeredBy || "", team: team(L, chat.service) });
    panel.querySelector("#as-end").hidden = false;
    panel.querySelector("#as-lang").closest("label").hidden = true;
    input.placeholder = EU.tIn(L, "as.chat.placeholder", { team: team(L, chat.service) });
    panel.classList.add("is-chat");
  }

  function showMessages(list) {
    for (const m of list) {
      if (m.id <= chat.lastId) continue;
      chat.lastId = m.id;
      if (m.from === "resident") {
        if (!chat.skipOwn) bubble("msg--me", EU.esc(m.body), "", EU.tIn(chat.lang, "as.you"));
        continue;
      }
      const who = m.name
        ? EU.tIn(chat.lang, "as.chat.teamName", { name: m.name, team: team(chat.lang, chat.service) })
        : EU.tIn(chat.lang, "as.chat.teamOnly", { team: team(chat.lang, chat.service) });
      const div = bubble("msg--team", EU.esc(m.body), "", who);
      div.dir = "auto";
      if (panel.hidden) EU.toast(EU.tIn(chat.lang, "as.chat.replied", { team: team(chat.lang, chat.service) }));
    }
    chat.skipOwn = false;
  }

  function enterChat(c, { fresh = false } = {}) {
    chat = {
      ref: c.ref,
      service: c.service,
      status: c.status,
      lang: EU.LANGS.includes(c.lang) ? c.lang : EU.lang,
      answeredBy: c.answeredBy,
      lastId: 0,
    };
    begin();
    chips.innerHTML = "";
    if (fresh) {
      // what they typed is already on screen; don't show it twice
      chat.lastId = Math.max(0, ...c.messages.map((m) => m.id));
      note(tl(chat.lang, "as.chat.started", { team: team(chat.lang, chat.service) }), chat.lang);
    } else {
      note(tl(chat.lang, "as.chat.resumed", { team: team(chat.lang, chat.service) }), chat.lang);
      showMessages(c.messages);
    }
    chatHead();
    listen();
    watchWait(c);
  }

  // If nobody has answered after 10 minutes, offer a call-back instead
  function watchWait(c) {
    clearTimeout(waitTimer);
    if (c.status !== "waiting") return;
    waitTimer = setTimeout(
      () => {
        if (chat && chat.status === "waiting")
          note(`${tl(chat.lang, "as.chat.slow")} ${link("report.html", tl(chat.lang, "as.chat.slowLink"))}`, chat.lang);
      },
      10 * 60 * 1000,
    );
  }

  function listen() {
    if (chatLive || !("EventSource" in window)) return;
    chatLive = new EventSource("/api/chats/live");
    chatLive.addEventListener("change", catchUp);
    chatLive.onerror = () => {
      if (chatLive && chatLive.readyState === EventSource.CLOSED) {
        chatLive = null;
        setTimeout(() => chat && listen(), 8000);
      }
    };
  }

  async function catchUp() {
    if (!chat) return;
    try {
      const c = (await call("/api/chats/mine?after=" + chat.lastId)).chat;
      if (!c) return leaveChat("idle");
      showMessages(c.messages);
      if (c.status !== chat.status || c.answeredBy !== chat.answeredBy) {
        chat.status = c.status;
        chat.answeredBy = c.answeredBy;
        if (c.status === "closed") return leaveChat(c.closedBy || "team");
        chatHead();
      }
    } catch (e) {
      /* the next update will try again */
    }
  }

  async function sendChat(text) {
    text = String(text || "")
      .trim()
      .slice(0, 1000);
    if (!text || !chat) return;
    input.value = "";
    bubble("msg--me", EU.esc(text), "", EU.tIn(chat.lang, "as.you")).dir = "auto";
    try {
      const c = (await call("/api/chats/mine/messages", { body: text })).chat;
      chat.skipOwn = true; // the one we just showed comes back in the list
      showMessages(c.messages);
    } catch (err) {
      if (err.message === "chatClosed") return leaveChat("team");
      note(tl(chat.lang, "as.chat.err"), chat.lang);
      input.value = text;
    }
  }

  async function endChat() {
    if (!chat) return;
    try {
      await call("/api/chats/mine/end", {});
    } catch (e) {
      /* it closes by itself after a while */
    }
    leaveChat("resident");
  }

  function leaveChat(by) {
    if (!chat) return;
    const L = chat.lang;
    note(tl(L, "as.chat.ended." + (["resident", "team", "idle"].includes(by) ? by : "team")), L);
    if (chatLive) {
      chatLive.close();
      chatLive = null;
    }
    clearTimeout(waitTimer);
    chat = null;
    panel.classList.remove("is-chat");
    panel.querySelector("#as-sub").hidden = true;
    panel.querySelector("#as-end").hidden = true;
    panel.querySelector("#as-lang").closest("label").hidden = false;
    input.placeholder = EU.t("as.placeholder");
    renderChips();
  }

  // A chat that was going on before the page changed or reloaded
  async function resumeChat() {
    try {
      const c = (await call("/api/chats/mine")).chat;
      if (c && c.status !== "closed") enterChat(c);
    } catch (e) {
      /* no chat, or offline */
    }
  }

  // Exposed for testing in the console: EU.Assistant.answer("کارەبا لە عەنکاوە هەیە؟")
  EU.Assistant = {
    answer,
    detectLang,
    understand,
    open: (q) => open(q),
    reset: () => {
      lastArea = null;
      lastService = null;
      lastIntent = null;
      misses = 0;
      flow = null;
    },
    flowNext,
    setLang: pickLang,
  };

  document.addEventListener("DOMContentLoaded", build);
})();
