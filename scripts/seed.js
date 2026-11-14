/* © 2026 NorthPoint Tech. All rights reserved.

   Fills a local database with believable example data, so you can see
   every page working before real people use the site:

     npm run seed            adds example reports, cuts, news and requests
     npm run seed -- --fresh deletes the local database first

   Never run this on the live server. It refuses when NODE_ENV=production. */
import fs from "node:fs";
import { config } from "../server/config.js";
import { createApp } from "../server/app.js";
import { newId, newRef, scramble, hashPassword } from "../server/lib/crypto.js";

if (config.isProduction) {
  console.error("seed: refusing to add example data with NODE_ENV=production.");
  process.exit(1);
}
if (process.argv.includes("--fresh")) {
  for (const f of [config.dbFile, config.dbFile + "-wal", config.dbFile + "-shm"]) fs.rmSync(f, { force: true });
}

const { db, close } = createApp(config);
const now = Date.now();
const MIN = 60_000;
const dev = (n) => scramble("seed", "dev", "example-" + n);

// [area, service, problem, minutes ago, people, fine, note]
const REPORTS = [
  ["ankawa", "electricity", "no_power", 42, 18, 0, "Whole street dark since about 8:30."],
  ["ankawa", "water", "low_pressure", 20, 6, 0, ""],
  ["city-centre", "electricity", "cable_damage", 180, 12, 0, "Transformer near the bazaar was smoking."],
  ["city-centre", "water", "no_water", 95, 4, 0, ""],
  ["brayati", "electricity", "weak_voltage", 120, 7, 0, ""],
  ["brayati", "water", "low_pressure", 240, 3, 0, ""],
  ["kasnazan", "electricity", "keeps_cutting", 300, 9, 0, ""],
  ["kasnazan", "water", "no_water", 330, 3, 0, ""],
  ["mantik", "electricity", "generator", 360, 2, 0, ""],
  ["shorsh", "electricity", "weak_voltage", 480, 5, 0, ""],
  ["shorsh", "water", "dirty_water", 540, 2, 0, ""],
  ["baharka", "electricity", "no_power", 30, 1, 0, ""],
  ["bakhtiari", "electricity", "keeps_cutting", 720, 4, 0, ""],
  ["gulan", "electricity", "other_power", 170, 1, 0, "Street lights off on the main road."],
  ["zanko", "water", "broken_pipe", 1300, 4, 3, ""],
  ["iskan", "electricity", "no_power", 900, 3, 0, ""],
];

const insert =
  db.prepare(`INSERT INTO reports (id, area, service, problem, note, people, fine, created_by, started_at, last_activity_at, confirmed_at, resolved_at)
  VALUES (@id, @area, @service, @problem, @note, @people, @fine, @by, @started, @last, @confirmed, @resolved)`);
REPORTS.forEach(([area, service, problem, ago, people, fine, note], i) => {
  const started = now - ago * MIN;
  insert.run({
    id: newId("r"),
    area,
    service,
    problem,
    note,
    people,
    fine,
    by: dev(i),
    started,
    last: started + Math.min(ago, 30) * MIN,
    confirmed: people >= 2 ? started + 12 * MIN : null,
    resolved: fine >= 3 ? started + ago * MIN * 0.8 : null,
  });
});

// A few weeks of history for the dashboard: 3–9 reports a day, mostly in the evening
const AREAS = ["ankawa", "iskan", "brayati", "shorsh", "gulan", "mantik", "zanko", "turaq", "raparin", "kasnazan"];
const PROBLEMS = {
  electricity: ["no_power", "keeps_cutting", "weak_voltage", "some_houses"],
  water: ["no_water", "low_pressure", "dirty_water"],
};
let seedNum = 7;
const rand = () => (seedNum = (seedNum * 16807) % 2147483647) / 2147483647;
for (let day = 1; day <= 28; day++) {
  const count = 3 + Math.floor(rand() * 7);
  for (let k = 0; k < count; k++) {
    const service = rand() < 0.65 ? "electricity" : "water";
    const hour = [17, 18, 19, 20, 21, 22, 8, 13][Math.floor(rand() * 8)];
    const started = now - day * 24 * 60 * MIN - (new Date(now).getUTCHours() + 3 - hour) * 60 * MIN;
    const people = 1 + Math.floor(rand() * 14);
    const fixAfter = (40 + rand() * 300) * MIN;
    insert.run({
      id: newId("r"),
      area: AREAS[Math.floor(rand() * AREAS.length)],
      service,
      problem: PROBLEMS[service][Math.floor(rand() * PROBLEMS[service].length)],
      note: "",
      people,
      fine: people <= 2 ? 1 : Math.max(3, Math.ceil(people / 3)),
      by: "",
      started,
      last: started + fixAfter,
      confirmed: people >= 2 ? started + (5 + rand() * 30) * MIN : null,
      resolved: started + fixAfter,
    });
  }
}

// Planned cuts around now
const hour = 60 * MIN;
const base = Math.floor(now / hour) * hour;
db.prepare(
  `INSERT INTO notices (id, service, areas, starts_at, ends_at, reason, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  newId("n"),
  "electricity",
  JSON.stringify(["waziran", "bakhtiari"]),
  base - hour,
  base + 3 * hour,
  JSON.stringify({
    en: "Maintenance on the feeder line. Generators in the area are on.",
    ckb: "چاککردنەوەی هێڵی دابەشکردن. مۆلیدەکانی ناوچەکە کار دەکەن.",
    kmr: "Lênêrîna xeta belavkirinê. Jeneratorên herêmê dixebitin.",
    ar: "صيانة خط التغذية. مولدات المنطقة تعمل.",
  }),
  JSON.stringify({
    en: "Erbil Electricity Distribution",
    ckb: "دابەشکردنی کارەبای هەولێر",
    kmr: "Belavkirina Kehreba ya Hewlêrê",
    ar: "توزيع كهرباء أربيل",
  }),
  now,
  now,
);
db.prepare(
  `INSERT INTO notices (id, service, areas, starts_at, ends_at, reason, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  newId("n"),
  "water",
  JSON.stringify(["raparin", "gulan", "zanko"]),
  base + 3 * hour,
  base + 11 * hour,
  JSON.stringify({
    en: "Pipe connection works for the new water network. Fill your tank before it starts.",
    ckb: "کاری بەستنەوەی بۆری بۆ تۆڕی نوێی ئاو. پێش دەستپێکردن تانکییەکەت پڕ بکە.",
    kmr: "Karên girêdana boriyan ji bo tora avê ya nû. Berî destpêkê tanka xwe tije bike.",
    ar: "أعمال ربط الأنابيب لشبكة الماء الجديدة. املأ خزانك قبل أن تبدأ.",
  }),
  JSON.stringify({
    en: "Erbil Water Directorate",
    ckb: "بەڕێوەبەرایەتی ئاوی هەولێر",
    kmr: "Rêveberiya Ava Hewlêrê",
    ar: "مديرية ماء أربيل",
  }),
  now,
  now,
);

// Team news
db.prepare(
  `INSERT INTO news (id, service, date, outlet, url, title, lang, heads, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  newId("w"),
  "electricity",
  new Date(now + 3 * hour).toISOString().slice(0, 10),
  "Erbil Electricity Distribution",
  "",
  "Evening load is higher this week; expect short cuts in the west",
  "en",
  JSON.stringify({
    ckb: "ئەم هەفتەیە باری ئێواران زیاترە؛ چاوەڕێی بڕانی کورت بکەن لە ڕۆژئاوا",
    kmr: "Vê hefteyê barê êvaran zêdetir e; li rojava li benda qutbûnên kurt bin",
    ar: "الأحمال المسائية أعلى هذا الأسبوع؛ توقّعوا انقطاعات قصيرة في الغرب",
  }),
  JSON.stringify({
    en: "Crews are on standby in Brayati and Bakhtiari between 18:00 and 23:00.",
    ckb: "تیمەکان لە نێوان ١٨:٠٠ و ٢٣:٠٠ لە برایەتی و بەختیاری ئامادەن.",
    kmr: "Tîm di navbera 18:00 û 23:00an de li Birayetî û Bextiyarî amade ne.",
    ar: "الفرق في حالة تأهّب في برايتي وبختياري بين ١٨:٠٠ و٢٣:٠٠.",
  }),
  now,
  now,
);

// Team accounts to try the roles (only if they don't exist)
const people = [
  ["admin", "Site Admin", "admin", null],
  ["sara", "Sara Ahmed", "supervisor", "electricity"],
  ["karwan", "Karwan Omar", "staff", "electricity"],
  ["rozhan", "Rozhan Aziz", "supervisor", "water"],
  ["dilan", "Dilan Hassan", "staff", "water"],
];
const made = [];
for (const [username, name, role, service] of people) {
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) continue;
  db.prepare(
    `INSERT INTO users (username, display_name, role, service, password_hash, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(username, name, role, service, hashPassword("try-it-locally"), now, now);
  made.push(username);
}

// Private requests in the inbox
const req =
  db.prepare(`INSERT INTO requests (id, ref, service, area, problem, scope, name, phone, place, preferred_time, contact_via, note, lang, status, device, created_at, updated_at, first_response_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
req.run(
  newId("q"),
  newRef(),
  "electricity",
  "ankawa",
  "no_power",
  "home",
  "Hawre",
  "07501112233",
  "Behind the Ankawa mall, Street 60",
  "evening",
  "call",
  "Only our house. The breaker keeps tripping.",
  "en",
  "new",
  dev(90),
  now - 25 * MIN,
  now - 25 * MIN,
  null,
);
req.run(
  newId("q"),
  newRef(),
  "electricity",
  "iskan",
  "weak_voltage",
  "few",
  "Shilan",
  "07709998877",
  "Near Iskan mosque",
  "morning",
  "whatsapp",
  "Lights dim in three houses on our lane.",
  "ckb",
  "contacted",
  dev(91),
  now - 5 * hour,
  now - 3 * hour,
  now - 3 * hour,
);
req.run(
  newId("q"),
  newRef(),
  "water",
  "gulan",
  "no_water",
  "home",
  "Ahmad",
  "07514445566",
  "Gulan Tower 2, block B",
  "any",
  "call",
  "No water since yesterday, neighbours have it.",
  "ar",
  "new",
  dev(92),
  now - 70 * MIN,
  now - 70 * MIN,
  null,
);

/* Neighbourhood generators: where Runaki hasn't arrived (Baharka,
   Kasnazan), one kept as backup where it has (Gulan), and a compound's own.
   Names and numbers are made up. The committee prices are April 2026's
   real ones for Erbil, Duhok and Soran (erbilbusinessnews.com, 30 March
   2026), entered for this month as an example.                          */
const gen =
  db.prepare(`INSERT INTO generators (id, area, name, owner, phone, covers, kind, status, hours, price, note, updated_at, updated_via, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const GENS = [
  [
    "baharka",
    "Street 12 generator",
    "Kak Hemin",
    "07500000012",
    "Streets 10 to 14",
    "neighbourhood",
    "running",
    [
      { from: "14:00", to: "18:00" },
      { from: "20:00", to: "01:00" },
    ],
    15000,
    "Running until the grid is back.",
    "owner",
    20,
  ],
  [
    "baharka",
    "Market generator",
    "Abu Sherwan",
    "",
    "The market and the streets behind it",
    "neighbourhood",
    "standby",
    [],
    16000,
    "",
    "owner",
    95,
  ],
  [
    "kasnazan",
    "Kasnazan centre",
    "Mam Jalal",
    "07500000034",
    "The centre and the school",
    "neighbourhood",
    "off",
    [{ from: "16:00", to: "00:00" }],
    14000,
    "Off for repairs today, back tomorrow.",
    "owner",
    300,
  ],
  ["gulan", "Gulan backup", "", "", "Gulan blocks 1 to 6", "backup", "standby", [], null, "", "team", 2 * 24 * 60],
  [
    "pavilion",
    "Pavilion compound generator",
    "Compound management",
    "",
    "All the houses in the compound",
    "compound",
    "off",
    [],
    null,
    "",
    "team",
    3 * 24 * 60,
  ],
];
for (const [area, name, owner, phone, covers, kind, status, hours, price, note, via, minsAgo] of GENS) {
  const at = now - minsAgo * MIN;
  gen.run(newId("g"), area, name, owner, phone, covers, kind, status, JSON.stringify(hours), price, note, at, via, at);
}
const month = new Date(now + 3 * 3600e3).toISOString().slice(0, 7);
const price = db.prepare(
  "INSERT OR REPLACE INTO generator_prices (city, month, price, hours, source, set_at) VALUES (?, ?, ?, ?, ?, ?)",
);
price.run("erbil", month, 15000, 300, "Example: April 2026's price", now);
price.run("duhok", month, 12500, null, "Example: April 2026's price", now);
price.run("soran", month, 7000, null, "Example: April 2026's price", now);

// every report gets its number (OUT-1, OUT-2…), oldest first, as the site gives them
db.prepare(
  `UPDATE reports SET no = (SELECT COUNT(*) FROM reports r2 WHERE r2.started_at < reports.started_at OR (r2.started_at = reports.started_at AND r2.id <= reports.id))
  WHERE no IS NULL`,
).run();

close();
console.log(
  `seed: added ${REPORTS.length} current reports, 4 weeks of history, 2 planned cuts, 1 news item, 3 private requests and ${GENS.length} generators.`,
);
if (made.length) console.log(`seed: team accounts ${made.join(", ")} (password for all: try-it-locally)`);
