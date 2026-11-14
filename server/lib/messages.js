/* © 2026 NorthPoint Tech. All rights reserved.
   The few sentences the server writes itself: push notification texts.
   Everything else on the site is translated in the browser (strings.js). */
import { areaName } from "./places.js";

const T = {
  "out.electricity": {
    en: "No power in {area}",
    ckb: "کارەبا لە {area} نییە",
    kmr: "Li {area} kehreba tune",
    ar: "لا توجد كهرباء في {area}",
  },
  "out.water": {
    en: "No water in {area}",
    ckb: "ئاو لە {area} نییە",
    kmr: "Li {area} av tune",
    ar: "لا يوجد ماء في {area}",
  },
  "out.body": {
    en: "{n} neighbours have reported it. Tap to see the latest.",
    ckb: "{n} دراوسێ ڕایانگەیاندووە. دابگرە بۆ بینینی دوایین زانیاری.",
    kmr: "{n} cîranan ragihandiye. Bitikîne da ku ya herî nû bibînî.",
    ar: "أبلغ عنه {n} من الجيران. اضغط لرؤية آخر المستجدات.",
  },
  "cut.electricity": {
    en: "Planned power cut: {area}",
    ckb: "بڕانی پلانکراوی کارەبا: {area}",
    kmr: "Qutbûna kehrebê ya plankirî: {area}",
    ar: "انقطاع كهرباء مجدول: {area}",
  },
  "cut.water": {
    en: "Planned water cut: {area}",
    ckb: "بڕانی پلانکراوی ئاو: {area}",
    kmr: "Qutbûna avê ya plankirî: {area}",
    ar: "انقطاع ماء مجدول: {area}",
  },
  "fix.title": {
    en: "A crew is working on it in {area}",
    ckb: "تیمێک لە {area} خەریکی چاککردنەوەیە",
    kmr: "Li {area} tîmek li ser dixebite",
    ar: "فريق يعمل على الإصلاح في {area}",
  },
  "fix.electricity": {
    en: "The electricity team says a crew is on the way to fix the power cut.",
    ckb: "تیمی کارەبا دەڵێت تیمێک بەڕێوەیە بۆ چاککردنەوەی بڕانی کارەبا.",
    kmr: "Tîma kehrebayê dibêje tîmek di rê de ye ku birîna kehrebayê çêbike.",
    ar: "يقول فريق الكهرباء إن فريقًا في الطريق لإصلاح انقطاع الكهرباء.",
  },
  "fix.water": {
    en: "The water team says a crew is on the way to fix the water problem.",
    ckb: "تیمی ئاو دەڵێت تیمێک بەڕێوەیە بۆ چاککردنەوەی کێشەی ئاو.",
    kmr: "Tîma avê dibêje tîmek di rê de ye ku pirsgirêka avê çareser bike.",
    ar: "يقول فريق المياه إن فريقًا في الطريق لإصلاح مشكلة المياه.",
  },
  "cut.body": {
    en: "{when}. {reason}",
    ckb: "{when}. {reason}",
    kmr: "{when}. {reason}",
    ar: "{when}. {reason}",
  },
  "gen.title": {
    en: "Generator on in {area}",
    ckb: "مۆلیدە لە {area} کار دەکات",
    kmr: "Li {area} moelîde dixebite",
    ar: "مولدة تعمل في {area}",
  },
  "gen.body": {
    en: "{name} is running{hours}.",
    ckb: "{name} کار دەکات{hours}.",
    kmr: "{name} dixebite{hours}.",
    ar: "{name} تعمل{hours}.",
  },
  "gen.hours": { en: ": {hours}", ckb: ": {hours}", kmr: ": {hours}", ar: ": {hours}" },
  urgent: { en: "Urgent", ckb: "بەپەلە", kmr: "Lezgîn", ar: "عاجل" },
  "test.general": {
    en: "We'll send you the important messages from the electricity and water teams.",
    ckb: "پەیامە گرنگەکانی تیمەکانی کارەبا و ئاوت بۆ دەنێرین.",
    kmr: "Em ê peyamên girîng ên tîmên kehreb û avê ji te re bişînin.",
    ar: "سنرسل إليك الرسائل المهمة من فريقي الكهرباء والماء.",
  },
  allCity: { en: "all of Erbil", ckb: "هەموو هەولێر", kmr: "hemû Hewlêr", ar: "كل أربيل" },
  "test.title": { en: "Alerts are on", ckb: "ئاگادارکردنەوە چالاکە", kmr: "Hişyarî vekirî ne", ar: "التنبيهات مفعّلة" },
  "test.body": {
    en: "We'll let you know about cuts in {area}.",
    ckb: "دەربارەی بڕانەکانی {area} ئاگادارت دەکەینەوە.",
    kmr: "Em ê te ji qutbûnên li {area} haydar bikin.",
    ar: "سنُعلمك بالانقطاعات في {area}.",
  },
};

// for the native speakers' review page (server/services/words.js)
export const MESSAGES = T;

const EASTERN = "٠١٢٣٤٥٦٧٨٩";
const digits = (lang, text) =>
  lang === "ar" || lang === "ckb" ? String(text).replace(/\d/g, (d) => EASTERN[d]) : String(text);

export function message(key, lang, params = {}) {
  const entry = T[key] || {};
  const text = entry[lang] || entry.en || key;
  return text
    .replace(/\{(\w+)\}/g, (_, name) => (name in params ? digits(lang, params[name]) : ""))
    .replace(/\s+\.\s*$/, ".")
    .replace(/\.\s*\.$/, ".")
    .trim();
}

export function areasText(areas, lang) {
  if (areas.includes("all")) return message("allCity", lang);
  const comma = lang === "ar" || lang === "ckb" ? "، " : ", ";
  return areas.map((a) => areaName(a, lang)).join(comma);
}

// "14:00–18:00" in Erbil time
export function timeRange(from, to, lang) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baghdad",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return digits(lang, fmt.format(new Date(from)) + "–" + fmt.format(new Date(to)));
}

export function pickLang(obj, lang) {
  if (!obj) return "";
  const order = {
    ckb: ["ckb", "ar", "en", "kmr"],
    ar: ["ar", "en", "ckb", "kmr"],
    kmr: ["kmr", "en", "ckb", "ar"],
    en: ["en", "kmr", "ckb", "ar"],
  }[lang] || ["en"];
  for (const k of [...order, "any"]) if (obj[k]) return obj[k];
  return "";
}
