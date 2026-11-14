/* © 2026 NorthPoint Tech. All rights reserved.

   The utilities' own places: substations, water plants, pumping stations,
   reservoirs and offices. The team adds each one with its name and spot,
   and they appear on the maps, so a crew sees what's near an outage.
   Nothing here is invented: the list is empty until the team fills it,
   or an admin brings in the real ones mapped on OpenStreetMap.

   Supervisors and admins add and change them, each for their own service
   (admins for both); everyone on the team sees them.                    */
import { newId } from "../lib/crypto.js";
import { plainText } from "../lib/text.js";
import { badRequest, notFound, forbidden } from "../lib/http.js";
import { AREAS } from "../lib/places.js";
import { OVERPASS_URL, OVERPASS_QUERY, sitesFromOsm } from "./osm-sites.js";

export const SITE_KINDS = ["substation", "plant", "pumping", "reservoir", "office"];
const SERVICES = ["electricity", "water"];

export function createSites({ db, audit, live, now, fetch: fetchImpl = globalThis.fetch, overpassUrl = OVERPASS_URL }) {
  const toSite = (r) => ({
    id: r.id,
    kind: r.kind,
    service: r.service,
    name: r.name,
    note: r.note,
    lat: r.lat,
    lng: r.lng,
    osm: r.osm || null,
    updatedAt: r.updated_at,
  });

  function read(input, partial) {
    const out = {};
    if (!partial || input.kind !== undefined) {
      if (!SITE_KINDS.includes(input.kind)) throw badRequest("badKind");
      out.kind = input.kind;
    }
    if (!partial || input.service !== undefined) {
      if (!SERVICES.includes(input.service)) throw badRequest("badService");
      out.service = input.service;
    }
    if (!partial || input.name !== undefined) {
      out.name = plainText(input.name, 80);
      if (!out.name) throw badRequest("needName");
    }
    if (input.note !== undefined) out.note = plainText(input.note, 200);
    if (!partial || input.spot !== undefined) {
      const lat = Number(input.spot && input.spot.lat),
        lng = Number(input.spot && input.spot.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 34.4 || lat > 37.5 || lng < 42.2 || lng > 46.5)
        throw badRequest("badSpot");
      out.lat = Math.round(lat * 1e5) / 1e5;
      out.lng = Math.round(lng * 1e5) / 1e5;
    }
    return out;
  }

  function mayEdit(user, service) {
    if (user.role === "staff") throw forbidden("supervisorOnly");
    if (user.role !== "admin" && service && user.service !== service) throw forbidden("notYours");
  }

  const changed = () => live.publish("sites", {});

  return {
    list() {
      return db.prepare("SELECT * FROM sites ORDER BY service, kind, name").all().map(toSite);
    },
    create(user, input) {
      const s = read(input, false);
      mayEdit(user, s.service);
      const id = newId("s"),
        t = now();
      db.prepare(
        `INSERT INTO sites (id, kind, service, name, note, lat, lng, created_by, created_at, updated_at)
        VALUES (@id, @kind, @service, @name, @note, @lat, @lng, @by, @t, @t)`,
      ).run({ note: "", ...s, id, by: user.id, t });
      audit.log(user, "site.create", {
        targetType: "site",
        targetId: id,
        service: s.service,
        detail: { name: s.name },
      });
      changed();
      return toSite(db.prepare("SELECT * FROM sites WHERE id = ?").get(id));
    },
    update(user, id, input) {
      const cur = db.prepare("SELECT * FROM sites WHERE id = ?").get(id);
      if (!cur) throw notFound();
      mayEdit(user, cur.service);
      const s = read(input, true);
      if (s.service) mayEdit(user, s.service);
      const keys = Object.keys(s);
      if (keys.length)
        db.prepare(
          `UPDATE sites SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = @t WHERE id = @id`,
        ).run({
          ...s,
          t: now(),
          id,
        });
      audit.log(user, "site.update", { targetType: "site", targetId: id, service: cur.service, detail: keys });
      changed();
      return toSite(db.prepare("SELECT * FROM sites WHERE id = ?").get(id));
    },
    /* Admins: bring in the real sites mapped on OpenStreetMap near our
       places. Ones already here (by OSM id) are left as the team has them. */
    async importOsm(user) {
      if (user.role !== "admin") throw forbidden("adminOnly");
      let json;
      try {
        const res = await fetchImpl(overpassUrl, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "ErbilUtilities/1.0 (utility sites import)",
          },
          body: "data=" + encodeURIComponent(OVERPASS_QUERY),
          signal: AbortSignal.timeout(150000),
        });
        if (!res.ok) throw new Error("status " + res.status);
        json = await res.json();
      } catch {
        throw badRequest("osmDown");
      }
      const places = AREAS.filter((a) => a.lat != null);
      const found = sitesFromOsm(json, places);
      const t = now();
      const add = db.prepare(
        `INSERT INTO sites (id, kind, service, name, note, lat, lng, osm, created_by, created_at, updated_at)
        VALUES (@id, @kind, @service, @name, '', @lat, @lng, @osm, @by, @t, @t)
        ON CONFLICT (osm) WHERE osm IS NOT NULL DO NOTHING`,
      );
      let added = 0;
      db.transaction(() => {
        for (const s of found) added += add.run({ ...s, id: newId("s"), by: user.id, t }).changes;
      })();
      audit.log(user, "site.import", { targetType: "site", detail: { found: found.length, added } });
      if (added) changed();
      return { found: found.length, added };
    },
    remove(user, id) {
      const cur = db.prepare("SELECT * FROM sites WHERE id = ?").get(id);
      if (!cur) throw notFound();
      mayEdit(user, cur.service);
      db.prepare("DELETE FROM sites WHERE id = ?").run(id);
      audit.log(user, "site.delete", {
        targetType: "site",
        targetId: id,
        service: cur.service,
        detail: { name: cur.name },
      });
      changed();
    },
  };
}
