/* © 2026 NorthPoint Tech. All rights reserved.
   News found on the news sites. Nothing here reaches the internet: the
   "sites" are small pages served by a fake fetch.             npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";
import { judge, linksFrom, itemsFrom, articleFrom } from "../server/services/newsfeed.js";

const page = (title, desc, date = "2026-10-15T09:00:00+03:00", lang = "en") =>
  `<!doctype html><html lang="${lang}"><head><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
   <meta property="article:published_time" content="${date}"></head><body>…</body></html>`;

const SITES = {
  "https://www.rudaw.net/english/kurdistan": `<ul>
    <li><a href="/english/kurdistan/151020261"><img src="x.jpg"></a><a href="/english/kurdistan/151020261">Erbil power cuts get longer as Runaki hours drop</a></li>
    <li><a href="/english/kurdistan/151020262">Football: Erbil SC wins the derby in front of 20,000 fans</a></li>
    <li><a href="/english/kurdistan/151020263">Drought dries up wells in villages around Erbil</a></li>
    <li><a href="/english/kurdistan/151020264">Parties argue over power-sharing deal in Kurdistan</a></li>
    <li><a href="/english/kurdistan/151020265">Old story: Erbil electricity plant opens</a></li>
    <li><a href="https://elsewhere.example/english/kurdistan/1">Not Rudaw at all</a></li></ul>`,
  "https://www.rudaw.net/english/kurdistan/151020261": page(
    "Erbil power cuts get longer as Runaki hours drop",
    "Residents in Erbil say electricity now comes for 18 hours a day after a fault at a power plant.",
  ),
  "https://www.rudaw.net/english/kurdistan/151020263": page(
    "Drought dries up wells in villages around Erbil",
    "Groundwater levels near Erbil have fallen, and families are buying water from tankers.",
  ),
  "https://www.rudaw.net/english/kurdistan/151020265": page(
    "Erbil electricity plant opens",
    "A new power plant in Erbil.",
    "2026-08-01T09:00:00+03:00",
  ),
  "https://gov.krd/moel-en/activities/categories/news/": `<a href="https://gov.krd/moel-en/activities/news-and-press-releases/2026/october/minister-visits-substation/">Minister visits new substation</a>`,
  "https://gov.krd/moel-en/activities/news-and-press-releases/2026/october/minister-visits-substation": page(
    "Minister visits new 132 kV substation",
    "The minister opened the new substation, which will carry 200 megawatts.",
  ),
};

let calls = [];
async function fakeFetch(url) {
  calls.push(url);
  const body = SITES[url.replace(/\/$/, "")] ?? SITES[url];
  if (body === undefined) return { ok: false, status: 404, text: async () => "" };
  return { ok: true, status: 200, text: async () => body };
}

let app;
before(async () => {
  app = await startTestApp({ fetch: fakeFetch });
  // Only the two sites above, so the test knows exactly what's there
  app.db.prepare("UPDATE news_sources SET active = 0 WHERE name NOT IN ('Rudaw', 'KRG Ministry of Electricity')").run();
});
after(async () => {
  await app.stop();
});

test("the filter: power and water news about the region, not politics or sport", () => {
  assert.equal(judge({ title: "Erbil power cuts get longer" }).service, "electricity");
  assert.equal(judge({ title: "Drought dries up wells in villages around Erbil" }).service, "water");
  assert.equal(judge({ title: "Parties argue over power-sharing deal in Kurdistan" }), null);
  assert.equal(judge({ title: "Erbil SC wins the derby" }), null);
  assert.equal(judge({ title: "Power cuts in Texas after the storm" }), null, "needs a place in the region");
  assert.ok(
    judge({ title: "Minister visits new substation" }, { trusted: true }),
    "official sources don't need a place",
  );
  assert.equal(judge({ title: "کارەبای هەولێر ١٨ کاتژمێر دەبێت" }).service, "electricity");
  assert.equal(judge({ title: "شح المياه في أربيل" }).service, "water");
  assert.equal(judge({ title: "Travel tips for Erbil" }), null, "'av' inside a word isn't water");
});

test("reading pages, feeds and articles", () => {
  const links = linksFrom(
    SITES["https://www.rudaw.net/english/kurdistan"],
    "https://www.rudaw.net/english/kurdistan",
    "^https://www\\.rudaw\\.net/english/kurdistan/\\d+",
  );
  assert.equal(links.length, 5);
  assert.equal(
    links[0].title,
    "Erbil power cuts get longer as Runaki hours drop",
    "the headline wins over the picture link",
  );
  const rss = itemsFrom(
    `<rss><channel><item><title><![CDATA[Water &amp; power in Erbil]]></title><link>https://x.example/a?utm=1</link><pubDate>Thu, 15 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`,
    "https://x.example/",
  );
  assert.deepEqual([rss[0].title, rss[0].url], ["Water & power in Erbil", "https://x.example/a"]);
  const a = articleFrom(page("A &quot;title&quot;", "Sum", "2026-10-01", "ar"));
  assert.deepEqual([a.title, a.lang], ['A "title"', "ar"]);
});

test("a run finds the right stories once, and only a person publishes them", async () => {
  const boss = await app.admin();
  const first = await boss.post("/api/team/news/check");
  assert.equal(first.status, 200);
  assert.equal(first.body.result.found, 3);
  assert.equal(first.body.result.failed, 0);
  assert.ok(
    !calls.some((u) => u.includes("151020262") || u.includes("151020264")),
    "headlines that aren't ours aren't opened",
  );
  assert.ok(!calls.some((u) => u.includes("elsewhere.example")));

  const { body } = await boss.get("/api/team/news/suggestions");
  const titles = body.suggestions.map((x) => x.title).sort();
  assert.deepEqual(titles, [
    "Drought dries up wells in villages around Erbil",
    "Erbil power cuts get longer as Runaki hours drop",
    "Minister visits new 132 kV substation",
  ]);
  assert.equal(body.suggestions.find((x) => x.title.startsWith("Drought")).service, "water");
  assert.equal(app.db.prepare("SELECT COUNT(*) FROM news").pluck().get(), 0, "nothing is published by itself");

  // Again: nothing new, and nothing fetched twice
  calls = [];
  const again = await boss.post("/api/team/news/check");
  assert.equal(again.body.result.found, 0);
  assert.equal(calls.filter((u) => u.includes("/151020261")).length, 0);

  // A water team member sees only water, and can't touch electricity ones
  const { c: water } = await app.member(boss, { username: "zana", service: "water" });
  const theirs = (await water.get("/api/team/news/suggestions")).body.suggestions;
  assert.deepEqual(
    theirs.map((x) => x.service),
    ["water"],
  );
  const power = body.suggestions.find((x) => x.service === "electricity");
  assert.equal((await water.post(`/api/team/news/suggestions/${power.id}`, { action: "publish" })).status, 403);
  assert.equal((await water.post("/api/team/news/check")).status, 403, "staff can't start a run");

  const pub = await water.post(`/api/team/news/suggestions/${theirs[0].id}`, { action: "publish" });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.news.outlet, "Rudaw");
  assert.equal(pub.body.news.service, "water");
  assert.equal(
    (await water.post(`/api/team/news/suggestions/${theirs[0].id}`, { action: "publish" })).status,
    400,
    "only once",
  );
  const site = await app.client().get("/api/state");
  assert.ok(JSON.stringify(site.body).includes("Drought dries up wells"));

  const gone = await boss.post(`/api/team/news/suggestions/${power.id}`, { action: "dismiss" });
  assert.equal(gone.status, 200);
});

test("admins: sources, broken sites, and publishing the clearest ones automatically", async () => {
  const boss = await app.admin();
  const add = await boss.post("/api/team/news/sources", {
    source: { name: "Broken", url: "https://broken.example/news", kind: "page", pattern: "^https://broken" },
  });
  assert.equal(add.status, 201);
  assert.equal(
    (
      await boss.post("/api/team/news/sources", {
        source: { name: "Bad", url: "https://x.example", kind: "page", pattern: "([" },
      })
    ).body.reason,
    "badPattern",
  );
  assert.equal(
    (await boss.post("/api/team/news/sources", { source: { name: "Plain", url: "http://x.example", kind: "feed" } }))
      .body.reason,
    "badUrl",
  );

  SITES["https://www.rudaw.net/english/kurdistan"] +=
    `<a href="/english/kurdistan/151020266">Erbil electricity: Runaki adds 300 megawatts to the grid</a>`;
  SITES["https://www.rudaw.net/english/kurdistan/151020266"] = page(
    "Erbil electricity: Runaki adds 300 megawatts to the grid",
    "The Ministry of Electricity says Erbil power supply will rise.",
  );
  assert.equal((await boss.post("/api/team/news/auto", { on: true })).body.on, true);
  const run = await boss.post("/api/team/news/check");
  assert.equal(run.body.result.published, 1);
  assert.equal(run.body.result.failed, 1);

  const { body } = await boss.get("/api/team/news/sources");
  assert.match(body.sources.find((x) => x.name === "Broken").lastError, /404/);
  assert.equal(body.auto, true);
  assert.equal(app.db.prepare("SELECT COUNT(*) FROM news WHERE title LIKE '%300 megawatts%'").pluck().get(), 1);
  assert.equal((await boss.del(`/api/team/news/sources/${add.body.source.id}`)).status, 200);
});

test("a headline can be given in other languages", async () => {
  const boss = await app.admin();
  const made = await boss.post("/api/team/news", {
    service: "water",
    item: {
      title: "Erbil wells run dry",
      lang: "en",
      url: "https://example.org/a",
      head: { en: "ignored: the original is the title", ckb: "بیرەکانی هەولێر وشک بوون" },
    },
  });
  assert.equal(made.status, 201);
  assert.deepEqual(made.body.item.head, { ckb: "بیرەکانی هەولێر وشک بوون" });
  assert.equal(made.body.item.lang, "en");
});

test("admins can show a pop-up on the public site, take it down, and nobody else can", async () => {
  const boss = await app.admin();
  const { c: staff } = await app.member(boss, { username: "popstaff", service: "water" });
  const t0 = app.clock.t;
  assert.equal((await staff.post("/api/team/popups", { popup: { title: { en: "x" } } })).status, 403);
  assert.equal((await boss.post("/api/team/popups", { popup: { title: {} } })).body.reason, "needTitle");
  assert.equal(
    (await boss.post("/api/team/popups", { popup: { title: { en: "x" }, link: "javascript:alert(1)" } })).body.reason,
    "badUrl",
  );
  assert.equal(
    (await boss.post("/api/team/popups", { popup: { title: { en: "x" }, from: t0, to: t0 + 40 * 864e5 } })).body.reason,
    "tooLong",
  );

  const made = await boss.post("/api/team/popups", {
    popup: {
      kind: "urgent",
      title: { en: "Water off in the west tomorrow", ckb: "سبەی ئاو لە ڕۆژئاوا دەبڕێت" },
      body: { en: "From 8:00 to 14:00." },
      link: "/map.html",
      push: true,
    },
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.popup.state, "on");
  assert.equal(made.body.popup.pushed, 0, "no phones subscribed in this test");
  let st = (await app.client().get("/api/state")).body;
  assert.equal(st.popup.title.ckb, "سبەی ئاو لە ڕۆژئاوا دەبڕێت");
  assert.equal(st.popup.kind, "urgent");
  assert.equal(st.popup.createdBy, undefined, "no names go public");

  // one that starts later doesn't show yet, and the running one keeps showing
  await boss.post("/api/team/popups", { popup: { title: { en: "Later" }, from: t0 + 864e5, to: t0 + 2 * 864e5 } });
  assert.equal((await app.client().get("/api/state")).body.popup.title.en, "Water off in the west tomorrow");

  const list = await boss.get("/api/team/popups");
  assert.equal(list.body.total, 2);
  assert.deepEqual(
    list.body.popups.map((p) => p.state),
    ["waiting", "on"],
  );
  assert.equal((await boss.post(`/api/team/popups/${made.body.popup.id}/end`)).body.popup.state, "ended");
  st = (await app.client().get("/api/state")).body;
  assert.equal(st.popup, null);
});

test("long lists say how many there are and come a page at a time, with nothing left out", async () => {
  const boss = await app.admin();
  const before = (await app.client().get("/api/state")).body.newsTotal;
  for (let i = 0; i < 35; i++)
    await boss.post("/api/team/news", {
      service: "electricity",
      item: { title: `Notice number ${i}`, date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}` },
    });
  const st = (await app.client().get("/api/state")).body;
  assert.equal(st.news.length, 30, "the live state carries the newest 30");
  assert.equal(st.newsTotal, before + 35);
  const page2 = (await app.client().get("/api/news?offset=30")).body;
  assert.equal(page2.total, before + 35);
  const ids = new Set([...st.news, ...page2.items].map((n) => n.id));
  assert.equal(ids.size, Math.min(before + 35, 60), "no doubles between pages");
  const team = (await boss.get("/api/team/news?offset=0")).body;
  assert.equal(team.total, before + 35);
  const chats = (await boss.get("/api/team/chats?status=closed")).body;
  assert.equal(typeof chats.total, "number");
  const reqs = (await boss.get("/api/team/requests?status=active")).body;
  assert.equal(reqs.total, reqs.requests.length);
});
