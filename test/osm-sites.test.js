/* © 2026 NorthPoint Tech. All rights reserved.
   Real utility sites from OpenStreetMap: only what OSM says, only near our
   places, never twice, admins only.                                 npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";
import { kindOf, sitesFromOsm } from "../server/services/osm-sites.js";

// Overpass's answer, shaped as it really comes (nodes with lat/lon, ways with a centre)
const answer = {
  elements: [
    {
      type: "way",
      id: 101,
      center: { lat: 36.2001, lon: 44.0102 },
      tags: { power: "substation", name: "وێستگەی نموونە" },
    },
    { type: "node", id: 102, lat: 36.1902, lon: 44.0201, tags: { man_made: "water_tower" } },
    { type: "node", id: 103, lat: 36.1903, lon: 44.0202, tags: { man_made: "pumping_station", substance: "sewage" } },
    { type: "node", id: 104, lat: 36.1904, lon: 44.0203, tags: { man_made: "pumping_station" } },
    {
      type: "node",
      id: 105,
      lat: 36.1905,
      lon: 44.0204,
      tags: { power: "substation", substation: "minor_distribution" },
    },
    { type: "node", id: 106, lat: 36.1906, lon: 44.0205, tags: { man_made: "storage_tank", content: "oil" } },
    { type: "node", id: 107, lat: 36.1907, lon: 44.0206, tags: { man_made: "pumping_station", substance: "water" } },
    // far from every place: left out
    { type: "node", id: 108, lat: 35.0, lon: 42.3, tags: { power: "plant", name: "Far away" } },
  ],
};

let app;
let calls = 0;
before(async () => {
  app = await startTestApp({
    fetch: async (url, opts) => {
      if (!String(url).includes("overpass")) return new Response("", { status: 404 });
      calls++;
      assert.match(decodeURIComponent(String(opts.body)), /power"="substation/);
      return new Response(JSON.stringify(answer), { headers: { "content-type": "application/json" } });
    },
  });
});
after(async () => {
  await app.stop();
});

test("only real utility kinds count; nothing is guessed", () => {
  assert.deepEqual(kindOf({ power: "substation" }), { kind: "substation", service: "electricity" });
  assert.equal(kindOf({ man_made: "pumping_station" }), null); // could be sewage or oil
  assert.equal(kindOf({ man_made: "storage_tank", content: "oil" }), null);
  assert.equal(kindOf({ power: "substation", substation: "minor_distribution" }), null);
  const near = sitesFromOsm(answer, [{ lat: 36.19, lng: 44.01 }]);
  assert.deepEqual(near.map((s) => s.osm).sort(), ["node/102", "node/107", "way/101"]);
  const named = near.find((s) => s.osm === "way/101");
  assert.equal(named.name, "وێستگەی نموونە");
  assert.equal(near.find((s) => s.osm === "node/102").name, ""); // OSM has no name: none is made up
});

test("an admin brings them in once; a second time adds nothing", async () => {
  const boss = await app.admin();
  const first = await boss.post("/api/team/sites/import", {});
  assert.equal(first.status, 200);
  assert.equal(first.body.added, 3);
  const again = await boss.post("/api/team/sites/import", {});
  assert.equal(again.body.found, 3);
  assert.equal(again.body.added, 0);
  const { sites } = (await boss.get("/api/team/sites")).body;
  assert.equal(sites.filter((s) => s.osm).length, 3);
  assert.equal(sites.find((s) => s.osm === "way/101").lat, 36.2001);
  assert.equal(calls, 2);
});

test("only admins can bring them in", async () => {
  const boss = await app.admin();
  const { c } = await app.member(boss, { username: "sup1", role: "supervisor" });
  const r = await c.post("/api/team/sites/import", {});
  assert.equal(r.status, 403);
});
