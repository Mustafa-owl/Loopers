/* © 2026 NorthPoint Tech. All rights reserved.
   Knowing the site is healthy: /api/health, errors from the server and
   from residents' pages, and the admin System screen. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, MIN } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(() => app.stop());

test("health says which version is running, and 503 with the reason when something is wrong", async () => {
  const c = app.client();
  const ok = await c.get("/api/health");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.match(ok.body.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(ok.body.problems, []);

  // housekeeping runs every 10 minutes; after 31 without it, health says so
  app.advance(31 * MIN);
  const late = await c.get("/api/health");
  assert.equal(late.status, 503);
  assert.deepEqual(late.body.problems, ["housekeeping"]);
  app.services.monitor.tidied(true);
  assert.equal((await c.get("/api/health")).status, 200);
});

test("a script error from a resident's page is kept once, with a count, without the query string", async () => {
  const c = app.client();
  const err = {
    message: "TypeError: x is undefined",
    page: "/area.html?a=ankawa",
    file: "http://127.0.0.1/assets/js/pages/area.js?v=abc",
    line: 42,
  };
  assert.equal((await c.post("/api/errors", err)).status, 204);
  assert.equal((await c.post("/api/errors", err)).status, 204);
  const rows = app.services.monitor.recentErrors().filter((e) => e.source === "browser");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].place, "/area.html /assets/js/pages/area.js:42");
});

test("one browser can send at most 10 errors an hour", async () => {
  const c = app.client();
  for (let i = 0; i < 15; i++) await c.post("/api/errors", { message: "boom " + i, page: "/" });
  const mine = app.services.monitor.recentErrors().filter((e) => e.message.startsWith("boom "));
  assert.equal(mine.length, 10);
});

test("only admins see the System screen, and it counts requests and lists errors", async () => {
  const boss = await app.admin();
  const { c: staff } = await app.member(boss, { username: "sys-staff" });
  assert.equal((await staff.get("/api/team/system")).status, 403);

  await boss.get("/api/state");
  const res = await boss.get("/api/team/system");
  assert.equal(res.status, 200);
  const s = res.body.system;
  assert.ok(s.lastHour.requests > 0);
  assert.ok(s.lastHour.routes.some((r) => r.name === "GET /api/state"));
  assert.ok(s.errors.length > 0);

  const cleared = await boss.post("/api/team/system/errors/clear", {});
  assert.equal(cleared.status, 200);
  assert.equal((await boss.get("/api/team/system")).body.system.errors.length, 0);
});

test("an unexpected server error is answered as 'server' and shows on the System screen", async () => {
  const real = app.services.reports.listPublic;
  app.services.reports.listPublic = () => {
    throw new Error("disk on fire");
  };
  app.advance(2000); // past the one-second cache of /api/state
  const res = await app.client().get("/api/state");
  app.services.reports.listPublic = real;
  assert.equal(res.status, 500);
  assert.equal(res.body.reason, "server");
  const e = app.services.monitor.recentErrors().find((x) => x.message === "disk on fire");
  assert.ok(e);
  assert.equal(e.source, "server");
  assert.equal(e.place, "GET /api/state");
});
