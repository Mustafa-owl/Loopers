/* © 2026 NorthPoint Tech. All rights reserved.
   Neighbours saying "On here" / "Off here" about a generator.      npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, HOUR, MIN } from "./helpers.js";

let app, boss;
let seq = 0;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

async function generator(status = "running") {
  boss = await app.admin();
  const made = await boss.post("/api/team/generators", {
    generator: { area: "baharka", name: "Street " + Math.random().toString(36).slice(2, 6), status },
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return made.body.generator.id;
}
// straight from the service: /api/state is cached until something changes through the API
const checksOf = async (id) => app.services.generators.listPublic().find((g) => g.id === id).checks;
// a neighbour at another address (the test clients all share 127.0.0.1)
const elsewhere = (id, said, n) => {
  const add = app.db.prepare(
    "INSERT INTO generator_checks (generator_id, device, ip_hash, said, at) VALUES (?, ?, ?, ?, ?)",
  );
  for (let i = 0; i < n; i++) add.run(id, `dev-${++seq}`, `ip-${said}-${i}`, said, app.clock.t);
};

test("a tap counts, the same tap again takes it back, the other one changes it", async () => {
  const id = await generator();
  const phone = app.client();
  const on = await phone.post("/api/generators/check", { id, said: "on" });
  assert.equal(on.status, 200);
  assert.equal(on.body.mine, "on");
  assert.deepEqual(on.body.generator.checks, { on: 1, off: 0 });
  const off = await phone.post("/api/generators/check", { id, said: "off" });
  assert.deepEqual(off.body.generator.checks, { on: 0, off: 1 });
  const back = await phone.post("/api/generators/check", { id, said: "off" });
  assert.equal(back.body.mine, null);
  assert.deepEqual(await checksOf(id), { on: 0, off: 0 });
  assert.equal((await phone.post("/api/generators/check", { id, said: "maybe" })).body.reason, "badCheck");
  assert.equal((await phone.post("/api/generators/check", { id: "nope", said: "on" })).status, 404);
});

test("several phone codes from one address count once", async () => {
  const id = await generator();
  for (let i = 0; i < 5; i++) await app.client().post("/api/generators/check", { id, said: "off" });
  assert.deepEqual(await checksOf(id), { on: 0, off: 1 });
  elsewhere(id, "off", 2);
  assert.deepEqual(await checksOf(id), { on: 0, off: 3 });
});

test("taps stop counting after 2 hours, and when the status changes", async () => {
  const id = await generator("off");
  elsewhere(id, "on", 3);
  assert.deepEqual(await checksOf(id), { on: 3, off: 0 });
  app.advance(2 * HOUR + MIN);
  assert.deepEqual(await checksOf(id), { on: 0, off: 0 });

  elsewhere(id, "on", 2);
  boss = await app.admin(); // two hours on, the old session has ended
  // the owner saving the same status again (new hours) leaves them counting
  await boss.patch("/api/team/generators/" + id, { generator: { status: "off", note: "later" } });
  assert.deepEqual(await checksOf(id), { on: 2, off: 0 });
  app.advance(1000);
  await boss.patch("/api/team/generators/" + id, { generator: { status: "running" } });
  assert.deepEqual(await checksOf(id), { on: 0, off: 0 }, "taps about the old status no longer count");
});

test("the team sees the counts too, and removed generators can't be tapped", async () => {
  const id = await generator();
  elsewhere(id, "off", 2);
  const list = (await boss.get("/api/team/generators")).body.generators;
  assert.deepEqual(list.find((g) => g.id === id).checks, { on: 0, off: 2 });
  await boss.patch("/api/team/generators/" + id, { generator: { status: "removed" } });
  assert.equal((await app.client().post("/api/generators/check", { id, said: "on" })).status, 404);
});

test("one phone can't tap more than 20 times an hour", async () => {
  const id = await generator();
  const phone = app.client();
  for (let i = 0; i < 20; i++) await phone.post("/api/generators/check", { id, said: i % 2 ? "on" : "off" });
  const late = await phone.post("/api/generators/check", { id, said: "on" });
  assert.equal(late.status, 429);
  assert.equal(late.body.reason, "wait");
});

test("housekeeping forgets taps after a day", async () => {
  const id = await generator();
  elsewhere(id, "on", 2);
  app.advance(25 * HOUR);
  app.services.generators.pruneChecks();
  assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM generator_checks WHERE generator_id = ?").get(id).n, 0);
});
