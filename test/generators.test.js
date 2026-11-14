/* © 2026 NorthPoint Tech. All rights reserved.
   Neighbourhood generators: the team adds them, the owner updates theirs
   through a private link, residents see it in the state and get an alert
   when it starts running, and the committee's monthly price per city.
   Also the other Runaki cities.                                  npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, HOUR } from "./helpers.js";

let app, boss;
before(async () => {
  app = await startTestApp();
  boss = await app.admin();
});
after(async () => {
  await app.stop();
});

const add = (c, g) => c.post("/api/team/generators", { generator: g });

test("the other Runaki cities are areas too, each in its city", async () => {
  const { AREAS, CITIES, cityOf } = await import("../server/lib/places.js");
  assert.equal(CITIES.length, 11);
  for (const slug of ["slemani", "duhok", "halabja", "soran", "zakho", "ranya", "koya", "pirmam", "akre", "simel"]) {
    assert.equal(cityOf(slug), slug, slug + " is its own city");
  }
  assert.equal(cityOf("gulan"), "erbil");
  assert.equal(cityOf("farmanbaran"), "erbil");
  assert.equal(AREAS.find((a) => a.slug === "pavilion").kind, "compound");
  // a report in another city works like one in Erbil
  const sent = await app.client().post("/api/reports", { area: "zakho", service: "electricity", problem: "no_power" });
  assert.equal(sent.status, 200);
});

test("the team adds a generator, and residents see it in the state", async () => {
  const made = await add(boss, {
    area: "baharka",
    name: "Street 12 generator",
    owner: "Kak Hemin",
    phone: "0750 123 4567",
    covers: "Streets 10 to 14",
    status: "off",
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.generator.phone, "07501234567", "the phone is written one way");
  assert.equal(made.body.generator.hasLink, false);
  const st = (await app.client().get("/api/state")).body;
  const g = st.generators.find((x) => x.id === made.body.generator.id);
  assert.equal(g.name, "Street 12 generator");
  assert.equal(g.keyHash, undefined, "nothing about the link is public");
  assert.equal(g.hasLink, undefined);
});

test("bad input is refused", async () => {
  assert.equal((await add(boss, { area: "atlantis", name: "X" })).body.reason, "badArea");
  assert.equal((await add(boss, { area: "gulan", name: "" })).body.reason, "needName");
  assert.equal((await add(boss, { area: "gulan", name: "G", status: "exploded" })).body.reason, "badStatus");
  assert.equal(
    (await add(boss, { area: "gulan", name: "G", hours: [{ from: "25:00", to: "01:00" }] })).body.reason,
    "badHours",
  );
  assert.equal((await add(boss, { area: "gulan", name: "G", price: 9_000_000 })).body.reason, "badPrice");
  assert.equal((await add(boss, { area: "gulan", name: "G", phone: "12" })).body.reason, "badPhone");
});

test("only the electricity team (and admins) can manage generators; only supervisors delete", async () => {
  const water = await app.member(boss, { username: "w-staff", service: "water" });
  assert.equal((await add(water.c, { area: "gulan", name: "G" })).status, 403);
  const staff = await app.member(boss, { username: "e-staff" });
  const made = await add(staff.c, { area: "gulan", name: "Gulan backup", kind: "backup", status: "standby" });
  assert.equal(made.status, 201);
  assert.equal((await staff.c.del("/api/team/generators/" + made.body.generator.id)).status, 403);
  assert.equal((await boss.del("/api/team/generators/" + made.body.generator.id)).status, 200);
});

test("the owner's private link: shown once, updates only that generator, and can be replaced", async () => {
  const g = (await add(boss, { area: "kasnazan", name: "Kasnazan centre" })).body.generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  assert.ok(key && key.length > 20);
  const owner = app.client();
  const mine = await owner.post("/api/generators/mine", { key });
  assert.equal(mine.body.generator.id, g.id);

  const up = await owner.post("/api/generators/update", {
    key,
    status: "running",
    hours: [
      { from: "14:00", to: "18:00" },
      { from: "20:00", to: "01:00" },
    ],
    price: 15000,
    note: "Running until the grid is back",
  });
  assert.equal(up.status, 200);
  assert.equal(up.body.generator.status, "running");
  assert.equal(up.body.generator.updatedVia, "owner");
  assert.equal(up.body.generator.price, 15000);

  // an owner can't take it off the site, or touch the name
  assert.equal((await owner.post("/api/generators/update", { key, status: "removed" })).body.reason, "badStatus");
  await owner.post("/api/generators/update", { key, name: "Something else" });
  assert.equal((await owner.post("/api/generators/mine", { key })).body.generator.name, "Kasnazan centre");

  // a new link stops the old one
  const fresh = (await boss.post(`/api/team/generators/${g.id}/link`)).body.key;
  assert.equal((await owner.post("/api/generators/mine", { key })).status, 404);
  assert.equal((await owner.post("/api/generators/mine", { key: fresh })).status, 200);
  await boss.post(`/api/team/generators/${g.id}/unlink`);
  assert.equal((await owner.post("/api/generators/mine", { key: fresh })).status, 404);
  assert.equal((await owner.post("/api/generators/mine", { key: "" })).status, 404);
});

test("when a generator starts running, followers of that area for electricity get one alert", async () => {
  const sub = (name) => ({ endpoint: "https://push.example.com/gen-" + name, keys: { p256dh: "k", auth: "a" } });
  const c = app.client();
  await c.post("/api/push/subscribe", {
    subscription: sub("power"),
    areas: ["shorsh"],
    services: ["electricity"],
    lang: "ckb",
  });
  await c.post("/api/push/subscribe", {
    subscription: sub("water"),
    areas: ["shorsh"],
    services: ["water"],
    lang: "en",
  });
  const g = (await add(boss, { area: "shorsh", name: "Shorsh 3" })).body.generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  const before = app.pushed.length;
  await app
    .client()
    .post("/api/generators/update", { key, status: "running", hours: [{ from: "16:00", to: "01:00" }] });
  await new Promise((r) => setTimeout(r, 50));
  const sent = app.pushed.slice(before).filter((p) => p.payload.tag === "gen-" + g.id);
  assert.equal(sent.length, 1, "only the electricity follower");
  assert.ok(sent[0].sub.endpoint.endsWith("gen-power"));
  assert.match(sent[0].payload.body, /١٦:٠٠/, "in the phone's language, Sorani digits");
  // off and on again within 3 hours: no second alert
  await app.client().post("/api/generators/update", { key, status: "off" });
  await app.client().post("/api/generators/update", { key, status: "running" });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(app.pushed.slice(before).filter((p) => p.payload.tag === "gen-" + g.id).length, 1);
});

test("the committee's monthly price per city, this month or last", async () => {
  const staff = await app.member(boss, { username: "e-staff-2" });
  assert.equal(
    (await staff.c.post("/api/team/generators/prices", { city: "erbil", month: "2026-10", price: 15000 })).status,
    403,
  );
  const set = await boss.post("/api/team/generators/prices", {
    city: "erbil",
    month: "2026-10",
    price: 15000,
    hours: 300,
    source: "Erbil private generator committee",
  });
  assert.equal(set.status, 200);
  await boss.post("/api/team/generators/prices", { city: "duhok", month: "2026-09", price: 12500 });
  await boss.post("/api/team/generators/prices", { city: "soran", month: "2026-06", price: 7000 });
  assert.equal(
    (await boss.post("/api/team/generators/prices", { city: "atlantis", month: "2026-10", price: 1 })).body.reason,
    "badCity",
  );
  assert.equal(
    (await boss.post("/api/team/generators/prices", { city: "erbil", month: "October", price: 1 })).body.reason,
    "badMonth",
  );
  const st = (await app.client().get("/api/state")).body;
  assert.deepEqual(st.generatorPrices.erbil, {
    month: "2026-10",
    price: 15000,
    hours: 300,
    source: "Erbil private generator committee",
  });
  assert.equal(st.generatorPrices.duhok.month, "2026-09", "last month's still counts");
  assert.equal(st.generatorPrices.soran, undefined, "June's is too old to show");
  // the owner's page compares with it
  const g = (await add(boss, { area: "gulan", name: "Gulan 2" })).body.generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  assert.equal((await app.client().post("/api/generators/mine", { key })).body.official.price, 15000);
});

test("an owner's link can't be used to flood the site", async () => {
  const g = (await add(boss, { area: "turaq", name: "Turaq 1" })).body.generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  const owner = app.client();
  let last;
  for (let i = 0; i < 31; i++) last = await owner.post("/api/generators/update", { key, note: "update " + i });
  assert.equal(last.status, 429);
  app.advance(HOUR + 1000);
  assert.equal((await owner.post("/api/generators/update", { key, note: "later" })).status, 200);
});
