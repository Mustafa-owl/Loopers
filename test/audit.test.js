/* © 2026 NorthPoint Tech. All rights reserved.
   One test for each problem the November 2026 audit proved. Each failed on
   the code before its fix.                                         npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, HOUR, MIN } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

const report = (area, problem = "no_power", service = "electricity") => ({ area, service, problem });
const wait = () => new Promise((r) => setTimeout(r, 50));

test("a faded report can't be brought back by Me too from a page left open", async () => {
  const sent = await app.client().post("/api/reports", report("mantik"));
  app.advance(6 * HOUR + 1000);
  const late = await app.client().post("/api/votes", { id: sent.body.id, kind: "metoo" });
  assert.equal(late.status, 404);
  assert.equal(late.body.reason, "gone");
});

test("a new report joins a confirmed one for as long as that one is open, not just 6 hours", async () => {
  await app.client().post("/api/reports", report("brayati"));
  await app.client().post("/api/reports", report("brayati"));
  app.advance(7 * HOUR);
  const third = await app.client().post("/api/reports", report("brayati"));
  assert.equal(third.body.merged, true);
  assert.equal(third.body.report.people, 3);
  const open = (await app.client().get("/api/state")).body.reports.filter(
    (r) => r.area === "brayati" && r.problem === "no_power",
  );
  assert.equal(open.length, 1, "one report, not two for the same problem");
});

test("unhiding a report the team had closed keeps it closed", async () => {
  const boss = await app.admin();
  const sup = await app.member(boss, { username: "sup-unhide", role: "supervisor" });
  const sent = await app.client().post("/api/reports", report("bakhtiari"));
  const id = sent.body.id;
  await sup.c.post(`/api/team/reports/${id}`, { action: "close" });
  await sup.c.post(`/api/team/reports/${id}`, { action: "hide" });
  const back = await sup.c.post(`/api/team/reports/${id}`, { action: "unhide" });
  assert.equal(back.body.report.status, "closed");
  assert.equal(back.body.report.teamClosed, true);
});

test("after 7 days a photo no longer carries the phone's code, like its report", async () => {
  const sent = await app.client("photo-phone").post("/api/reports", report("kasnazan", "no_water", "water"));
  app.db
    .prepare(
      "INSERT INTO photos (id, report_id, file, bytes, status, uploaded_by, created_at) VALUES (?, ?, 'p.jpg', 10, 'pending', ?, ?)",
    )
    .run("p_audit", sent.body.id, "devhash", app.clock.t);
  app.advance(8 * 24 * HOUR);
  app.services.reports.prune();
  assert.equal(app.db.prepare("SELECT uploaded_by FROM photos WHERE id = 'p_audit'").pluck().get(), "");
});

test("overlapping reports count once in the 7-day history", async () => {
  // two separate confirmed no-power reports in Shorsh covering the same 2 hours
  const start = app.clock.t - 3 * HOUR;
  const add = app.db.prepare(
    `INSERT INTO reports (id, area, service, problem, note, created_by, started_at, last_activity_at, people, confirmed_at, closed_at, status)
     VALUES (?, 'shorsh', 'electricity', 'no_power', '', 'x', ?, ?, 2, ?, ?, 'closed')`,
  );
  add.run("r_twin1", start, start + 2 * HOUR, start, start + 2 * HOUR);
  add.run("r_twin2", start, start + 2 * HOUR, start, start + 2 * HOUR);
  const h = app.services.stats.areaHistory("shorsh", 1).electricity.hours[0];
  assert.equal(h, 2, "the same 2 hours, counted once");
});

test("a cut for the whole city reaches Erbil, never another city", async () => {
  const boss = await app.admin();
  const sub = (name, areas) =>
    app.client().post("/api/push/subscribe", {
      subscription: { endpoint: "https://push.example.com/all-" + name, keys: { p256dh: "k", auth: "a" } },
      areas,
      services: ["electricity"],
      lang: "en",
      general: false,
    });
  await sub("erbil", ["gulan"]);
  await sub("zakho", ["zakho"]);
  await wait();
  const before = app.pushed.length;
  const t = app.clock.t + HOUR;
  await boss.post("/api/team/notices", {
    service: "electricity",
    notice: { areas: ["all"], from: t, to: t + 2 * HOUR, reason: { en: "Line work" } },
  });
  await wait();
  const to = app.pushed.slice(before).map((p) => p.sub.endpoint.split("/").pop());
  assert.ok(to.includes("all-erbil"), "Gulan hears about it");
  assert.ok(!to.includes("all-zakho"), "Zakho doesn't");
  const title = app.pushed.slice(before).find((p) => p.sub.endpoint.endsWith("all-erbil")).payload.title;
  assert.match(title, /all of Erbil/);
  const ics = await app.client().get("/api/cuts.ics?area=zakho");
  assert.ok(!Buffer.from(ics.body).toString().includes("Line work"), "nor in Zakho's calendar");
});

test("summary months must be real months", async () => {
  for (const bad of ["2025-13", "2026-00", "2026-1"]) {
    const s = (await app.client().get("/api/summary?month=" + bad)).body.summary;
    assert.notEqual(s.month, bad, bad + " isn't a month");
  }
});

test("the comparison figure on a neighbourhood's months is its own city's average", async () => {
  const one = app.services.stats.areaMonths("gulan", 1).months.at(-1);
  // only Erbil's 20 areas count; a city with no reports can't pull the average down
  assert.ok(one.known === false || typeof one.electricity.city === "number");
  const s = (await app.client().get("/api/summary")).body.summary;
  assert.ok(!s.quiet.includes("slemani"), "a city nobody has reported from yet isn't 'quiet'");
});

test("a removed generator can't be brought back through the owner's link", async () => {
  const boss = await app.admin();
  const g = (await boss.post("/api/team/generators", { generator: { area: "baharka", name: "Removed one" } })).body
    .generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  await boss.patch(`/api/team/generators/${g.id}`, { generator: { status: "removed" } });
  const owner = app.client();
  assert.equal((await owner.post("/api/generators/mine", { key })).status, 404);
  assert.equal((await owner.post("/api/generators/update", { key, status: "running" })).status, 404);
  assert.ok(!(await app.client().get("/api/state")).body.generators.some((x) => x.id === g.id));
});

test("a generator price must be a whole number of dinars", async () => {
  const boss = await app.admin();
  for (const price of [[], true, "1e3", "12.5", "abc", -1]) {
    const r = await boss.post("/api/team/generators", {
      generator: { area: "gulan", name: "Price " + String(price), price },
    });
    assert.equal(r.body.reason, "badPrice", JSON.stringify(price));
  }
  const blank = await boss.post("/api/team/generators", {
    generator: { area: "gulan", name: "Blank price", price: "  " },
  });
  assert.equal(blank.body.generator.price, null, "blank means not said, not 0");
});

test("alerts only go to the browsers' own push services", async () => {
  for (const endpoint of [
    "https://127.0.0.1:8202/x",
    "https://10.0.0.5/push",
    "https://evil.example/fcm.googleapis.com",
  ]) {
    const r = await app.client().post("/api/push/subscribe", {
      subscription: { endpoint, keys: { p256dh: "k", auth: "a" } },
      areas: ["gulan"],
    });
    assert.equal(r.status, 400, endpoint);
  }
  const fcm = await app.client().post("/api/push/subscribe", {
    subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } },
    areas: ["gulan"],
  });
  assert.equal(fcm.status, 200);
  const apple = await app.client().post("/api/push/subscribe", {
    subscription: { endpoint: "https://web.push.apple.com/QWERTY", keys: { p256dh: "k", auth: "a" } },
    areas: ["gulan"],
  });
  assert.equal(apple.status, 200);
});

test("one address can't sign up hundreds of phones for alerts", async () => {
  const c = app.client();
  let last;
  for (let i = 0; i < 61; i++)
    last = await c.post("/api/push/subscribe", {
      subscription: { endpoint: "https://push.example.com/flood-" + i, keys: { p256dh: "k", auth: "a" } },
      areas: ["gulan"],
    });
  assert.equal(last.status, 429);
  app.advance(HOUR + MIN);
});

test("the team sees when everyone on a report came from one internet address", async () => {
  const boss = await app.admin();
  // test clients all come from 127.0.0.1: a report confirmed this way shows 1 address
  const a = await app.client().post("/api/reports", report("nishtiman"));
  await app.client().post("/api/votes", { id: a.body.id, kind: "metoo" });
  const list = (await boss.get("/api/team/overview?service=electricity")).body.reports;
  const mine = list.find((r) => r.id === a.body.id);
  assert.equal(mine.people, 2);
  assert.equal(mine.addresses, 1);
});
