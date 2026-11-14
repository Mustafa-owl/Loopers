/* © 2026 NorthPoint Tech. All rights reserved.
   Exact spots: where a resident reported from (team only, 7 days), and where
   a generator stands.                                              npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, HOUR } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

const ankawa = { lat: 36.2284, lng: 43.9953 };

test("a shared spot reaches the team, not the public, and goes after 7 days", async () => {
  const one = app.client(),
    two = app.client();
  const a = await one.post("/api/reports", {
    area: "ankawa",
    service: "electricity",
    problem: "no_power",
    spot: { ...ankawa, accuracy: 12 },
  });
  // a neighbour's report merges; their spot is kept too
  await two.post("/api/reports", {
    area: "ankawa",
    service: "electricity",
    problem: "no_power",
    spot: { lat: 36.2291, lng: 43.9961 },
  });
  // a spot far from the chosen place is ignored
  await app.client().post("/api/reports", {
    area: "ankawa",
    service: "electricity",
    problem: "no_power",
    spot: { lat: 36.19, lng: 44.6 },
  });
  const boss = await app.admin();
  const r = (await boss.get("/api/team/overview")).body.reports.find((x) => x.id === a.body.id);
  assert.equal(r.spots.length, 2);
  assert.deepEqual([r.spots[0].lat, r.spots[0].lng, r.spots[0].accuracy], [36.2284, 43.9953, 12]);
  const pub = (await app.client().get("/api/state")).body.reports.find((x) => x.id === a.body.id);
  assert.equal(pub.spots, undefined, "residents never see anyone's spot");

  app.advance(8 * 24 * HOUR);
  app.services.reports.prune();
  assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM report_spots").get().n, 0);
});

test("a generator's spot: the owner from their phone, the team too; nonsense refused", async () => {
  const boss = await app.admin();
  const g = (await boss.post("/api/team/generators", { generator: { area: "baharka", name: "Spot test" } })).body
    .generator;
  const { key } = (await boss.post(`/api/team/generators/${g.id}/link`)).body;
  const near = { lat: 36.2701, lng: 43.9802 };
  const owner = await app.client().post("/api/generators/update", { key, spot: near });
  assert.equal(owner.status, 200, JSON.stringify(owner.body));
  assert.equal(owner.body.generator.lat, near.lat);
  const pub = (await app.client().get("/api/state")).body.generators.find((x) => x.id === g.id);
  assert.equal(pub.lng, near.lng, "a generator's spot is public: people need to find it");
  const far = await app.client().post("/api/generators/update", { key, spot: { lat: 35.56, lng: 45.43 } });
  assert.equal(far.body.reason, "badSpot");
  const cleared = await boss.patch(`/api/team/generators/${g.id}`, { generator: { spot: null } });
  assert.equal(cleared.body.generator.lat, null);
});

test("utility sites: supervisors add them for their service, staff can't, all see them", async () => {
  const boss = await app.admin();
  const sup = await app.member(boss, { username: "site-sup", role: "supervisor", service: "water" });
  const staff = await app.member(boss, { username: "site-staff", role: "staff", service: "water" });
  const plant = { kind: "plant", service: "water", name: "Ifraz 2", spot: { lat: 36.25, lng: 43.75 } };
  const made = await sup.c.post("/api/team/sites", plant);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal((await staff.c.post("/api/team/sites", plant)).status, 403);
  assert.equal(
    (await sup.c.post("/api/team/sites", { ...plant, service: "electricity", kind: "substation" })).status,
    403,
  );
  assert.equal((await sup.c.post("/api/team/sites", { ...plant, spot: { lat: 10, lng: 10 } })).body.reason, "badSpot");
  const seen = (await staff.c.get("/api/team/sites")).body.sites;
  assert.ok(seen.some((x) => x.name === "Ifraz 2" && x.lat === 36.25));
  await sup.c.del("/api/team/sites/" + made.body.site.id);
  assert.equal((await staff.c.get("/api/team/sites")).body.sites.length, 0);
});
