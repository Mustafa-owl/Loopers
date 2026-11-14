/* © 2026 NorthPoint Tech. All rights reserved.

   The assistant's exam. Each line is a question the way people really type
   it, the language it should answer in, and what it should understand.
   When a new kind of question goes wrong, add it here first, then teach
   the assistant (the word lists in public/assets/js/assistant.js) until
   it passes.                                                              */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAssistant } from "./browser-sandbox.js";

const EU = loadAssistant();
const A = EU.Assistant;

// [question, answer language, what it understood, offer of a real person?]
const CASES = [
  // English: status
  ["is there power in ankawa", "en", "area"],
  ["any electricity in gulan right now?", "en", "area"],
  ["do we have water in brayati", "en", "area"],
  ["where is the power out", "en", "outages"],
  ["which areas have no water today", "en", "outages"],
  ["is there electricity", "en", "whichArea"],
  // English: planned cuts, news, bills
  ["are there any planned cuts tomorrow", "en", "planned"],
  ["is there a scheduled outage in ankawa", "en", "planned"],
  ["any news from the electricity directorate", "en", "news"],
  ["how much is 400 kwh", "en", "bill"],
  ["how do I pay my electricity bill online", "en", "pay"],
  ["what is runaki", "en", "runaki"],
  ["my generator bill is too high", "en", "generator"],
  // English: trouble at home
  ["only my house has no power", "en", "noPowerHome"],
  ["just our house is dark, the neighbours have lights", "en", "noPowerHome"],
  ["the breaker keeps tripping", "en", "breaker"],
  ["the main switch keeps going off", "en", "breaker"],
  ["my lights are flickering", "en", "flicker"],
  ["the voltage is jumping up and down", "en", "flicker"],
  ["water pressure is very weak", "en", "pressure"],
  ["only a trickle of water comes out", "en", "pressure"],
  ["no water only at my house", "en", "noWaterHome"],
  ["the water is brown and smells", "en", "dirty"],
  ["our tap water tastes salty", "en", "dirty"],
  ["is the water safe to drink", "en", "quality"],
  // English: time, why, follow-ups
  ["when will the power come back in gulan", "en", "eta"],
  ["how long until the water is back", "en", "eta"],
  ["why?", "en", "why"],
  // English: help, reports, people
  ["how do I report a problem", "en", "report"],
  ["can I send a photo", "en", "photo"],
  ["how do I check my request EU-7J2AGX", "en", "track"],
  ["can I get alerts on my phone", "en", "alerts"],
  ["I want to talk to a person", "en", "human", "asked"],
  ["can I speak to someone from the team", "en", "human", "asked"],
  ["there are sparks coming from the pole", "en", "danger", "danger"],
  ["a cable fell down in our street", "en", "danger", "danger"],
  ["no power for three days in kasnazan", "en", "area", "long"],
  ["this is useless", "en", "insult", "stuck"],
  ["hello", "en", "greet"],
  ["thanks a lot", "en", "thanks"],
  ["who made this site", "en", "about"],
  ["is my data private", "en", "privacy"],

  // Sorani
  ["کارەبا لە عەنکاوە هەیە؟", "ckb", "area"],
  ["ئاو لە گوڵان هەیە", "ckb", "area"],
  ["لە کوێ کارەبا نییە", "ckb", "outages"],
  ["بڕانی پلانکراو هەیە بۆ سبەینێ", "ckb", "planned"],
  ["هەواڵی نوێ چییە", "ckb", "news"],
  ["پسوولەی کارەبا چۆن بدەم", "ckb", "pay"],
  ["ڕووناکی چییە", "ckb", "runaki"],
  ["تەنها ماڵەکەم کارەبای نییە", "ckb", "noPowerHome"],
  ["قاتعەکە دەپەڕێت", "ckb", "breaker"],
  ["فۆڵتیەکە کەم و زۆر دەکات", "ckb", "flicker"],
  ["فشاری ئاوەکە زۆر لاوازە", "ckb", "pressure"],
  ["ئاوەکە بۆنی دێت", "ckb", "dirty"],
  ["ئاوەکە ڕەنگی گۆڕاوە و پیسە", "ckb", "dirty"],
  ["کارەبا کەی دێتەوە لە عەنکاوە", "ckb", "eta"],
  ["بۆچی؟", "ckb", "why"],
  ["دەمەوێت لەگەڵ کەسێک قسە بکەم", "ckb", "human", "asked"],
  ["کێبڵ کەوتووە لە شەقامەکەمان", "ckb", "danger", "danger"],
  ["سێ ڕۆژە ئاومان نییە لە بەحرکە", "ckb", "area", "long"],
  ["سڵاو", "ckb", "greet"],
  ["سوپاس", "ckb", "thanks"],

  // Kurmanji / Badini
  ["li enkawa kehreb heye?", "kmr", "area"],
  ["av li gulanê heye?", "kmr", "area"],
  ["li ku derê kehreb tune", "kmr", "outages"],
  ["tenê mala min kehreb tune", "kmr", "noPowerHome"],
  ["sîgorte dikeve", "kmr", "breaker"],
  ["zexta avê pir qels e", "kmr", "pressure"],
  ["ava me qirêj e", "kmr", "dirty"],
  ["kehreb kengî tê li enkawa?", "kmr", "eta"],
  ["ez dixwazim bi kesekî re biaxivim", "kmr", "human", "asked"],
  ["silav", "kmr", "greet"],
  ["spas", "kmr", "thanks"],

  // Arabic (Iraqi as people type it)
  ["اكو كهرباء بعنكاوة", "ar", "area"],
  ["هل يوجد ماء في كولان", "ar", "area"],
  ["وين ماكو كهرباء", "ar", "outages"],
  ["اكو قطع مبرمج باجر", "ar", "planned"],
  ["شكد سعر ٤٠٠ كيلو واط", "ar", "bill"],
  ["بس بيتنا ماكو كهرباء", "ar", "noPowerHome"],
  ["القاطع يفصل كل شوي", "ar", "breaker"],
  ["الفولتية متذبذبة والضوء يرمش", "ar", "flicker"],
  ["الماي ضعيف", "ar", "pressure"],
  ["الماء عكر وريحته مو زينة", "ar", "dirty"],
  ["شوكت ترجع الكهرباء بعنكاوة", "ar", "eta"],
  ["ليش؟", "ar", "why"],
  ["اريد احكي مع موظف", "ar", "human", "asked"],
  ["اكو شرارة من السلك", "ar", "danger", "danger"],
  ["ثلاث أيام ماكو ماي ببحركة", "ar", "area", "long"],
  ["مرحبا", "ar", "greet"],
  ["شكرا", "ar", "thanks"],

  // Second round: harder, closer to how people really type
  ["power is out again in ankawa", "en", "area"],
  ["electricity gone in zanko", "en", "area"],
  ["no light since morning in mamostayan", "en", "area", "long"],
  ["we have no water at all", "en", "outages"],
  ["is the national power on in iskan", "en", "area"],
  ["whole street is dark", "en", "outages"],
  ["my neighbours have power but we dont", "en", "noPowerHome"],
  ["our breaker trips every time the AC starts", "en", "breaker"],
  ["the fuse blew", "en", "breaker"],
  ["lights keep dimming", "en", "flicker"],
  ["the voltage is very low tonight", "en", "flicker"],
  ["barely any water pressure upstairs", "en", "pressure"],
  ["water is yellow", "en", "dirty"],
  ["tap water smells like sewage", "en", "dirty"],
  ["when is the electricity coming back", "en", "eta"],
  ["any idea when the water returns", "en", "eta"],
  ["is it fixed yet in ankawa", "en", "fixed"],
  ["a transformer exploded near us", "en", "danger", "danger"],
  ["wire hanging low over the road", "en", "danger", "danger"],
  ["can a real person help me", "en", "human", "asked"],
  ["i need customer service", "en", "human", "asked"],
  ["you dont understand me", "en", "unknown", "stuck"],
  ["what does runaki mean", "en", "runaki"],
  ["how much will i pay for 250 kwh", "en", "bill"],
  ["cuts planned for this week?", "en", "planned"],
  ["latest news", "en", "news"],
  ["good morning", "en", "greet"],
  ["کارەبامان نییە لە زانکۆ", "ckb", "area"],
  ["ئاو نییە", "ckb", "outages"],
  ["دراوسێکان کارەبایان هەیە بەڵام ئێمە نا", "ckb", "noPowerHome"],
  ["فیوزەکە سووتا", "ckb", "breaker"],
  ["گڵۆپەکان دەلەرزن", "ckb", "flicker"],
  ["ئاوەکە لیخنە", "ckb", "dirty"],
  ["ئاو کەی دێتەوە", "ckb", "eta"],
  ["مەحەوەلەکە تەقیەوە", "ckb", "danger", "danger"],
  ["کارمەندێکم دەوێت", "ckb", "human", "asked"],
  ["ڕۆژباش", "ckb", "greet"],
  ["kehreba me tune li zanko", "kmr", "area"],
  ["ava me tune", "kmr", "outages"],
  ["şalter her dem dikeve", "kmr", "breaker"],
  ["av bêhn dide", "kmr", "dirty"],
  ["av kengî vedigere?", "kmr", "eta"],
  ["kabloyek ketiye kolanê", "kmr", "danger", "danger"],
  ["الكهرباء طافية بزانكو", "ar", "area"],
  ["ماكو ماي", "ar", "outages"],
  ["الجيران عدهم كهرباء واحنا لا", "ar", "noPowerHome"],
  ["الفيوز يطفي", "ar", "breaker"],
  ["الكهرباء ضعيفة والاجهزة تطفي", "ar", "flicker"],
  ["الماي لونه اصفر", "ar", "dirty"],
  ["امتى ترجع الماي", "ar", "eta"],
  ["المحولة انفجرت", "ar", "danger", "danger"],
  ["ممكن احجي ويه شخص", "ar", "human", "asked"],
  ["صباح الخير", "ar", "greet"],
  ["karaba nya", "ckb-Latn", "outages"],
  ["awman nya la zanko", "ckb-Latn", "area"],
  ["kay karaba detawa", "ckb-Latn", "eta"],

  // Third round: ideas it hadn't met before (upstairs, milky, complain, since last night)
  ["we have had no electricity since last night in gulan", "en", "area", "long"],
  ["power keeps cutting out in shorsh", "en", "area"],
  ["is anyone else without power", "en", "outages"],
  ["the switch in the meter box went down", "en", "breaker"],
  ["my fridge stopped, the voltage is weak", "en", "flicker"],
  ["no water upstairs but downstairs is fine", "en", "pressure"],
  ["water looks milky", "en", "dirty"],
  ["by what time will the cut end", "en", "eta"],
  ["there is smoke from the transformer", "en", "danger", "danger"],
  ["i want to complain to someone", "en", "human", "asked"],
  ["how do i turn on notifications", "en", "alerts"],
  ["thank you so much", "en", "thanks"],
  ["bye", "en", "bye"],
  ["هێشتا کارەبا نییە لە شۆڕش", "ckb", "area", "long"],
  ["کارەبا هەر دەبڕێت", "ckb", "outages"],
  ["سپلیتەکە هەڵدەکەم قاتعەکە دەپەڕێت", "ckb", "breaker"],
  ["ئاوی سەرەوە نایەت", "ckb", "pressure"],
  ["ئاوەکە سپییە وەک شیر", "ckb", "dirty"],
  ["دووکەڵ لە مەحەوەلەکە دێت", "ckb", "danger", "danger"],
  ["دەمەوێت سکاڵا بکەم", "ckb", "human", "asked"],
  ["خوات لەگەڵ", "ckb", "bye"],
  ["kehreb hîn tune li şorş", "kmr", "area", "long"],
  ["şalter dikeve dema klîma vedibe", "kmr", "breaker"],
  ["ava jor nayê", "kmr", "pressure"],
  ["dû ji transformatorê tê", "kmr", "danger", "danger"],
  ["الكهرباء تنقطع كل شوي بشورش", "ar", "area"],
  ["من اشغل المكيف القاطع ينزل", "ar", "breaker"],
  ["الماي ما يصعد للطابق الثاني", "ar", "pressure"],
  ["الماي ابيض مثل الحليب", "ar", "dirty"],
  ["اكو دخان من المحولة", "ar", "danger", "danger"],
  ["اريد اشتكي", "ar", "human", "asked"],
  ["مع السلامة", "ar", "bye"],

  // Fourth round: talking like a person (heat, the fridge, saving, feelings, "are you an AI?")
  ["it's so hot and the power is out, what do I do", "en", "heat"],
  ["how long is food ok in the fridge without power", "en", "fridge"],
  ["will the meat in my freezer go bad", "en", "fridge"],
  ["how can I make my electricity bill lower", "en", "save"],
  ["tips to save power with the air conditioner", "en", "save"],
  ["how often should I clean the water tank", "en", "tank"],
  ["is the power out in ankwa", "en", "area"],
  ["water in brayeti?", "en", "area"],
  ["i'm so tired of these cuts", "en", "outages"],
  ["my mother needs her insulin cold and we have no power", "en", "outages", "long"],
  ["nothing works", "en", "clarify"],
  ["it's off again", "en", "clarify"],
  ["are you an ai?", "en", "whoami"],
  ["what's your name", "en", "whoami"],
  ["good night", "en", "bye"],
  ["ok thanks bye", "en", "bye"],
  ["can you help me", "en", "help"],
  ["گەرمایە و کارەبا نییە، چی بکەم", "ckb", "heat"],
  ["خواردنی ناو سەلاجە چەند دەمێنێت", "ckb", "fridge"],
  ["چۆن پسوولەی کارەبا کەم بکەمەوە", "ckb", "save"],
  ["تانکی ئاوەکە چۆن پاک بکەمەوە", "ckb", "tank"],
  ["ماندوو بووین لەم بڕانانە", "ckb", "outages"],
  ["دایکم دەرمانی هەیە دەبێت سارد بێت و کارەبامان نییە", "ckb", "outages", "long"],
  ["تۆ ڕۆبۆتیت؟", "ckb", "whoami"],
  ["şev baş", "kmr", "bye"],
  ["germ e û kehreb tune", "kmr", "heat"],
  ["çawa fatûreya kehrebê kêm bikim", "kmr", "save"],
  ["الجو حار والكهرباء مقطوعة شنو اسوي", "ar", "heat"],
  ["الاكل بالثلاجة يخرب؟", "ar", "fridge"],
  ["شلون اقلل فاتورة الكهرباء", "ar", "save"],
  ["شلون انظف خزان الماي", "ar", "tank"],
  ["تعبنا من القطع", "ar", "outages"],
  ["امي مريضة وعندها دواء لازم يبقى بارد وماكو كهرباء", "ar", "outages", "long"],
  ["انت ذكاء اصطناعي؟", "ar", "whoami"],
  ["تصبح على خير", "ar", "bye"],
  ["عنكاو فيها كهرباء؟", "ar", "area"],

  // Fifth round, from research into what Erbil residents actually face: Runaki's
  // call centre, the 50-day rule, old debt, registering, smart meters, tankers
  ["what is the runaki call center number", "en", "callcentre"],
  ["who do I call about my electricity bill", "en", "callcentre"],
  ["how many days do I have to pay the bill", "en", "deadline"],
  ["they cut my power because I didn't pay", "en", "deadline"],
  ["is there still a discount on old electricity debt", "en", "olddebt"],
  ["how do I register my house for runaki", "en", "register"],
  ["I just moved in, how do I put the house in my name", "en", "register"],
  ["is the smart meter free", "en", "meter"],
  ["will the new meter make my bill higher", "en", "meter"],
  ["I paid my bill twice by mistake", "en", "overpaid"],
  ["the collector came when I wasn't home", "en", "overpaid"],
  ["when will runaki come to our neighbourhood", "en", "runakiwhen"],
  ["is runaki going to be cancelled", "en", "runakiwhen"],
  ["how much does a water tanker cost", "en", "tanker"],
  ["where can I buy water, the tap has been dry for a week", "en", "tanker", "long"],
  ["how do I get a water connection for my new house", "en", "waterconnect"],
  ["ژمارەی سەنتەری پەیوەندیی ڕووناکی چەندە", "ckb", "callcentre"],
  ["چەند ڕۆژم هەیە بۆ دانی پسوولە", "ckb", "deadline"],
  ["کارەبایان بڕیم چونکە پسوولەم نەداوە", "ckb", "deadline"],
  ["داشکاندنی قەرزی کۆن ماوە؟", "ckb", "olddebt"],
  ["چۆن ماڵەکەم لە ڕووناکی تۆمار بکەم", "ckb", "register"],
  ["مێتەری زیرەک بە پارەیە؟", "ckb", "meter"],
  ["دوو جار پسوولەکەم دا", "ckb", "overpaid"],
  ["ڕووناکی کەی دێت بۆ گەڕەکی ئێمە", "ckb", "runakiwhen"],
  ["تانکەری ئاو بە چەندە", "ckb", "tanker"],
  ["hejmara navenda Runakî çi ye", "kmr", "callcentre"],
  ["çawa mala xwe li Runakî tomar bikim", "kmr", "register"],
  ["deyna kevn daxistin heye?", "kmr", "olddebt"],
  ["tankera avê bi çiqas e", "kmr", "tanker"],
  ["شنو رقم مركز اتصال روناكي", "ar", "callcentre"],
  ["كم يوم عندي حتى ادفع الفاتورة", "ar", "deadline"],
  ["قطعوا الكهرباء لان ما دفعت", "ar", "deadline"],
  ["اكو خصم على الديون القديمة؟", "ar", "olddebt"],
  ["شلون اسجل بيتي بروناكي", "ar", "register"],
  ["العداد الذكي ببلاش؟", "ar", "meter"],
  ["دفعت الفاتورة مرتين بالغلط", "ar", "overpaid"],
  ["متى روناكي توصل لمنطقتنا", "ar", "runakiwhen"],
  ["بيش تنكر الماي", "ar", "tanker"],
  ["شلون اسوي اشتراك ماء لبيت جديد", "ar", "waterconnect"],

  // Sorani typed in Latin letters
  ["karaba haya la ankawa?", "ckb-Latn", "area"],
  ["karaba nya la malakam", "ckb-Latn", "noPowerHome"],
  ["slaw", "ckb-Latn", "greet"],
];

test("the assistant understands the exam questions", () => {
  const wrong = [];
  for (const [q, lang, intent, offer] of CASES) {
    A.reset();
    const a = A.answer(q);
    const got = { lang: a.lang, intent: a.intent, offer: a.offer ? a.offer.reason : undefined };
    if (got.lang !== lang || got.intent !== intent || got.offer !== offer)
      wrong.push(`${q}\n    want ${lang} ${intent} ${offer || "-"}, got ${got.lang} ${got.intent} ${got.offer || "-"}`);
    assert.ok(!/\{\w+\}|undefined|NaN/.test(a.html), "unfilled text in the answer to: " + q);
  }
  const score = Math.round(((CASES.length - wrong.length) / CASES.length) * 100);
  console.log(`  assistant: ${CASES.length - wrong.length} of ${CASES.length} right (${score}%)`);
  assert.equal(wrong.length, 0, "\n  " + wrong.join("\n  "));
});

test("follow-up questions remember the conversation", () => {
  A.reset();
  assert.equal(A.answer("is there power in ankawa").intent, "area");
  assert.equal(A.answer("and the water?").intent, "area"); // same neighbourhood
  assert.equal(A.answer("when will it come back?").intent, "eta");
  A.reset();
  assert.equal(A.answer("planned cuts tomorrow").intent, "planned");
  assert.equal(A.answer("and gulan?").intent, "planned"); // same question, new place
});

test("step by step: answers can be tapped or typed, in the question's language", () => {
  A.reset();
  const first = A.answer("only my house has no power");
  assert.equal(first.intent, "noPowerHome");
  assert.match(first.html, /data-flow="noPower:ask:0"/);
  // typed "yes" → the neighbours have power → look at the meter box
  const next = A.answer("yes");
  assert.equal(next.intent, "flow");
  assert.match(next.html, /meter box/);
  // tapped "Yes, it's down" → into the breaker steps
  const tapped = A.flowNext("noPower", "box", 0);
  assert.equal(tapped.said, "Yes, it's down");
  assert.match(tapped.html, /push the main switch back up once/);
  // Arabic all the way through
  A.reset();
  A.answer("بس بيتنا ماكو كهرباء");
  const ar = A.answer("لا");
  assert.equal(ar.lang, "ar");
  assert.match(ar.html, /الخريطة/); // neighbours have none too → report it
  // a new question ends the steps
  A.reset();
  A.answer("the breaker keeps tripping");
  assert.equal(A.answer("is there water in gulan").intent, "area");
  assert.equal(A.answer("yes").intent, "yesno");
});

test("the safety advice never tells anyone to keep resetting or to drink doubtful water", () => {
  A.reset();
  A.answer("the breaker keeps tripping");
  const tripsAgain = A.flowNext("breaker", "reset", 1).html;
  assert.match(tripsAgain, /keep resetting it/);
  A.reset();
  assert.match(A.answer("the water is brown and smells").html, /drink it or use it for cooking/);
  A.reset();
  assert.match(A.answer("sparks from the cable").html, /122/); // Erbil's emergency line
});

test("a chosen answer language wins over the question's language", () => {
  A.reset();
  A.setLang("ar");
  assert.equal(A.answer("is there power in ankawa").lang, "ar");
  A.setLang(null);
  assert.equal(A.answer("is there power in ankawa").lang, "en");
});

test("it talks like a person: varied replies, noticing feelings, asking back", () => {
  A.reset();
  const one = A.answer("hello").html,
    two = A.answer("hello").html;
  assert.notEqual(one, two); // never the same greeting twice in a row
  A.reset();
  assert.match(A.answer("i'm so tired of these cuts").html, /exhausting|a lot to put up with|frustrating/);
  A.reset();
  const care = A.answer("my mother needs her insulin cold and we have no power");
  assert.match(care.html, /tell the team/);
  assert.equal(care.offer.reason, "long"); // and offers a person
  A.reset();
  const ask = A.answer("nothing works");
  assert.equal(ask.intent, "clarify");
  assert.match(ask.html, /data-q="nothing works Electricity"/); // a button that asks again
  A.reset();
  assert.equal(A.answer("is the power out in ankwa").intent, "area"); // one letter off
  A.reset();
  assert.match(A.answer("how long is food ok in the fridge without power").html, /about 4 hours/);
});

test("official facts come with their source, and the numbers are the real ones", () => {
  A.reset();
  const cc = A.answer("what is the runaki call center number").html;
  assert.match(cc, /1992/);
  assert.match(cc, /9 am to midnight/);
  assert.match(cc, /runaki\.gov\.krd/);
  A.reset();
  assert.match(A.answer("how many days do I have to pay the bill").html, /50 days[\s\S]*15 July 2026/);
  A.reset();
  assert.match(
    A.answer("is there still a discount on old electricity debt").html,
    /10 September 2026[\s\S]*It has ended/,
  );
  A.reset();
  assert.match(A.answer("بيش تنكر الماي").html, /964media/);
});
