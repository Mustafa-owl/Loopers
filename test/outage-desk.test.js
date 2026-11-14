/* © 2026 NorthPoint Tech. All rights reserved.
   The outage desk: numbers, the crew, when it's expected back, the cause. npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

test("reports get numbers in order, so people can say OUT-12 on the phone", async () => {
  const a = await app.client().post("/api/reports", { area: "ankawa", service: "electricity", problem: "no_power" });
  const b = await app.client().post("/api/reports", { area: "iskan", service: "water", problem: "no_water" });
  const boss = await app.admin();
  const list = (await boss.get("/api/team/overview")).body.reports;
  const no = (id) => list.find((r) => r.id === id).no;
  assert.ok(no(a.body.id) > 0);
  assert.equal(no(b.body.id), no(a.body.id) + 1);
});

test("the crew, the time back and the cause; residents see the time while a crew is on it", async () => {
  const sent = await app.client().post("/api/reports", { area: "gulan", service: "electricity", problem: "no_power" });
  const id = sent.body.id;
  const boss = await app.admin();
  await boss.post(`/api/team/reports/${id}`, { action: "confirm" });
  await boss.post(`/api/team/reports/${id}`, { action: "fixing" });
  const set = await boss.post(`/api/team/reports/${id}`, {
    action: "details",
    crew: "Crew 3, Karwan",
    etr: "23:30",
    cause: "fault",
  });
  assert.equal(set.status, 200);
  assert.equal(set.body.report.crew, "Crew 3, Karwan");
  assert.equal(set.body.report.cause, "fault");
  // 23:30 Erbil time is 20:30 UTC, the next one after now
  const etr = set.body.report.etr;
  assert.ok(etr > app.clock.t && etr - app.clock.t <= 24 * 3600e3);
  assert.equal(new Date(etr).getUTCHours(), 20);
  assert.equal(new Date(etr).getUTCMinutes(), 30);

  const pub = (await app.client().get("/api/state")).body.reports.find((r) => r.id === id);
  assert.equal(pub.etr, etr, "residents see when it's expected back");
  assert.equal(pub.crew, undefined, "but not the crew's names");

  assert.equal(
    (await boss.post(`/api/team/reports/${id}`, { action: "details", cause: "aliens" })).body.reason,
    "badCause",
  );
  assert.equal(
    (await boss.post(`/api/team/reports/${id}`, { action: "details", etr: "25:00" })).body.reason,
    "badTime",
  );

  // the crew coming back clears the crew and the time
  const off = await boss.post(`/api/team/reports/${id}`, { action: "fixing" });
  assert.equal(off.body.report.crew, null);
  assert.equal(off.body.report.etr, null);
});
