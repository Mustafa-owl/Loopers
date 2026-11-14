/* © 2026 NorthPoint Tech. All rights reserved.

   Neighbourhood generators.

   Where Runaki hasn't arrived, people still pay a neighbourhood generator
   by the ampere and it runs while the grid is off. Where Runaki has
   arrived, most were switched off, but some are kept as backup, and when the
   grid fails (a gas cut, a broken line) the governorate and the owners
   agree that they run again at set hours. Either way, what people want to
   know is the same: is our generator running, until when, and what does it
   cost this month.

   Who says so
     • The electricity team adds each generator and can change anything.
     • The owner gets a private link (no account, no password): opening it
       lets them say "running", "on standby" or "off", today's hours, this
       month's price and a short note. Only that one generator. The team can
       make a new link at any time, which stops the old one working.
     • Each month the team enters the price and hours the governorate's
       private-generator committee announced, per city, so residents can
       compare what their owner charges.

   When a generator starts running, people who follow that area for
   electricity get an alert (at most once every 3 hours per generator).

   Neighbours can say "On here" or "Off here". It's how residents find out
   that the owner's status is out of date, and how the team finds owners who
   don't update. Each address counts once, only taps from the last 2 hours
   and since the status last changed count, and the owner's word stays the
   status: the page only adds what the neighbours say.                    */
import { newId, randomToken, sha256 } from "../lib/crypto.js";
import { plainText, cleanPhone, clip } from "../lib/text.js";
import { isArea, isCity, cityOf, areaPoint } from "../lib/places.js";
import { badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { HOUR, erbilDay } from "../lib/time.js";
import { fromJson } from "../db/index.js";

export const STATUSES = ["running", "standby", "off", "removed"];
export const KINDS = ["neighbourhood", "compound", "backup"];
export const GENERATOR_RULES = {
  ownerUpdatesPerHour: 30,
  checkWindow: 2 * HOUR, // neighbours' "on here" / "off here" count this long
  checksPerHour: 20, // taps from one phone, all generators together
  checksPerHourIp: 60, // and from one address
  checksDisagree: 2, // addresses saying the opposite of the owner before the page says so
  maxHours: 4, // separate time ranges in one day
  maxPrice: 100_000, // dinars per ampere; anything above is a typing mistake
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function readHours(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw badRequest("badHours");
  if (raw.length > GENERATOR_RULES.maxHours) throw badRequest("tooManyHours");
  return raw.map((h) => {
    const from = String((h && h.from) || "");
    const to = String((h && h.to) || "");
    if (!TIME.test(from) || !TIME.test(to) || from === to) throw badRequest("badHours");
    return { from, to };
  });
}

// A whole number of dinars, as a number or digits; empty means "not said"
function readPrice(raw) {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return null;
  if (typeof raw === "string" && !/^\s*\d{1,6}\s*$/.test(raw)) throw badRequest("badPrice");
  if (typeof raw !== "string" && typeof raw !== "number") throw badRequest("badPrice");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > GENERATOR_RULES.maxPrice) throw badRequest("badPrice");
  return n;
}

export function createGenerators({ db, limits, live, push, audit, now }) {
  const get = db.prepare("SELECT * FROM generators WHERE id = ?");
  const byKey = db.prepare("SELECT * FROM generators WHERE key_hash = ?");

  // What anyone may see
  const toPublic = (g) => ({
    id: g.id,
    area: g.area,
    name: g.name,
    owner: g.owner,
    phone: g.phone,
    covers: g.covers,
    kind: g.kind,
    status: g.status,
    hours: fromJson(g.hours, []),
    price: g.price,
    note: g.note,
    lat: g.lat ?? null,
    lng: g.lng ?? null,
    updatedAt: g.updated_at,
    updatedVia: g.updated_via,
    statusAt: g.status_at || g.updated_at,
  });
  const toTeam = (g) => ({ ...toPublic(g), hasLink: !!g.key_hash, createdAt: g.created_at });

  const canEdit = (user) => user.role === "admin" || user.service === "electricity";
  function mustEdit(user) {
    if (!canEdit(user)) throw forbidden("electricityOnly");
  }

  function readGenerator(input, { partial = false, area = null } = {}) {
    const out = {};
    if (!partial || input.area !== undefined) {
      if (!isArea(input.area)) throw badRequest("badArea");
      out.area = input.area;
    }
    if (!partial || input.name !== undefined) {
      const name = plainText(input.name, 60);
      if (!name) throw badRequest("needName");
      out.name = name;
    }
    if (input.owner !== undefined) out.owner = plainText(input.owner, 60);
    if (input.phone !== undefined) {
      const phone = input.phone ? cleanPhone(input.phone) : "";
      if (input.phone && !phone) throw badRequest("badPhone");
      out.phone = phone || "";
    }
    if (input.covers !== undefined) out.covers = plainText(input.covers, 160);
    if (input.kind !== undefined) {
      if (!KINDS.includes(input.kind)) throw badRequest("badKind");
      out.kind = input.kind;
    }
    return { ...out, ...readStatus(input, out.area || area) };
  }

  // The part an owner may change
  function readStatus(input, area) {
    const out = {};
    // where it stands: { lat, lng } inside Kurdistan and near its area, or null to clear
    if (input.spot !== undefined) {
      if (input.spot === null) out.lat = out.lng = null;
      else {
        const lat = Number(input.spot && input.spot.lat),
          lng = Number(input.spot && input.spot.lng);
        const near = areaPoint(area);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < 34.4 ||
          lat > 37.5 ||
          lng < 42.2 ||
          lng > 46.5 ||
          (near && Math.hypot((lat - near.lat) * 111, (lng - near.lng) * 89) > 15)
        )
          throw badRequest("badSpot");
        out.lat = Math.round(lat * 1e5) / 1e5;
        out.lng = Math.round(lng * 1e5) / 1e5;
      }
    }
    if (input.status !== undefined) {
      if (!STATUSES.includes(input.status)) throw badRequest("badStatus");
      out.status = input.status;
    }
    if (input.hours !== undefined) out.hours = JSON.stringify(readHours(input.hours));
    if (input.price !== undefined) out.price = readPrice(input.price);
    if (input.note !== undefined) out.note = plainText(input.note, 140);
    return out;
  }

  function save(id, fields, via) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const t = now();
    // saving the same status again (new hours, say) leaves the neighbours' taps counting
    const statusChanged = fields.status && get.get(id).status !== fields.status;
    db.prepare(
      `UPDATE generators SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = @t, updated_via = @via${statusChanged ? ", status_at = @t" : ""} WHERE id = @id`,
    ).run({ ...fields, t, via, id });
  }

  /* ---- what the neighbours say ---- */

  // Per generator: how many addresses said on and off, recently and since the status changed
  const checksQuery = db.prepare(
    `SELECT c.generator_id AS id, c.said, COUNT(DISTINCT COALESCE(c.ip_hash, c.device)) AS n
    FROM generator_checks c JOIN generators g ON g.id = c.generator_id
    WHERE c.at > @since AND c.at >= COALESCE(g.status_at, 0)
    GROUP BY c.generator_id, c.said`,
  );
  function allChecks() {
    const out = new Map();
    for (const row of checksQuery.all({ since: now() - GENERATOR_RULES.checkWindow })) {
      if (!out.has(row.id)) out.set(row.id, { on: 0, off: 0 });
      out.get(row.id)[row.said] = row.n;
    }
    return out;
  }
  const withChecks = (list, map = allChecks()) =>
    list.map((g) => ({ ...g, checks: map.get(g.id) || { on: 0, off: 0 } }));

  // Tell the area's followers when a generator starts running
  function maybeAlert(before, after) {
    // no alert for a generator whose area is no longer on the site: there's no page to send people to
    if (after.status === "running" && before.status !== "running" && isArea(after.area) && push && push.generator) {
      push.generator(toPublic(after)).catch((e) => console.error("[push] generator:", e.message));
    }
  }

  function changed(g) {
    live.publish("generators", { area: g.area, id: g.id });
  }

  return {
    listPublic() {
      return withChecks(
        db.prepare("SELECT * FROM generators WHERE status != 'removed' ORDER BY area, name").all().map(toPublic),
      );
    },

    listTeam() {
      return withChecks(db.prepare("SELECT * FROM generators ORDER BY area, name").all().map(toTeam));
    },

    /* A neighbour taps "On here" or "Off here". The same again takes it back. */
    check(input, who) {
      const said = input.said === "on" ? "on" : input.said === "off" ? "off" : null;
      if (!said) throw badRequest("badCheck");
      const g = get.get(String(input.id || ""));
      if (!g || g.status === "removed") throw notFound("gone");
      if (
        limits.count("gencheck", who.device, HOUR) >= GENERATOR_RULES.checksPerHour ||
        limits.count("gencheck:ip", who.ip, HOUR) >= GENERATOR_RULES.checksPerHourIp
      )
        throw tooMany("wait");
      limits.record("gencheck", who.device);
      limits.record("gencheck:ip", who.ip);
      const t = now();
      const prev = db
        .prepare("SELECT said, at FROM generator_checks WHERE generator_id = ? AND device = ?")
        .get(g.id, who.device);
      const stillCounts = prev && prev.at > t - GENERATOR_RULES.checkWindow && prev.at >= (g.status_at || 0);
      let mine = said;
      if (stillCounts && prev.said === said) {
        db.prepare("DELETE FROM generator_checks WHERE generator_id = ? AND device = ?").run(g.id, who.device);
        mine = null;
      } else {
        db.prepare(
          `INSERT INTO generator_checks (generator_id, device, ip_hash, said, at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(generator_id, device) DO UPDATE SET said = excluded.said, ip_hash = excluded.ip_hash, at = excluded.at`,
        ).run(g.id, who.device, who.ip, said, t);
      }
      changed(g);
      const [generator] = withChecks([toPublic(g)]);
      return { generator, mine };
    },

    // housekeeping: a day is plenty
    pruneChecks() {
      db.prepare("DELETE FROM generator_checks WHERE at < ?").run(now() - 24 * HOUR);
    },

    create(user, input) {
      mustEdit(user);
      const g = readGenerator(input);
      const id = newId("g");
      const t = now();
      db.prepare(
        `INSERT INTO generators (id, area, name, owner, phone, covers, kind, status, hours, price, note, updated_at, updated_via, created_by, created_at, status_at)
        VALUES (@id, @area, @name, @owner, @phone, @covers, @kind, @status, @hours, @price, @note, @t, 'team', @by, @t, @t)`,
      ).run({
        owner: "",
        phone: "",
        covers: "",
        kind: "neighbourhood",
        status: "off",
        hours: "[]",
        price: null,
        note: "",
        ...g,
        id,
        t,
        by: user.id,
      });
      audit.log(user, "generator.create", {
        targetType: "generator",
        targetId: id,
        service: "electricity",
        detail: { area: g.area, name: g.name },
      });
      const row = get.get(id);
      maybeAlert({ status: "off" }, row);
      changed(row);
      return toTeam(row);
    },

    update(user, id, input) {
      mustEdit(user);
      const cur = get.get(id);
      if (!cur) throw notFound();
      const fields = readGenerator(input, { partial: true, area: cur.area });
      save(id, fields, "team");
      audit.log(user, "generator.update", {
        targetType: "generator",
        targetId: id,
        service: "electricity",
        detail: Object.keys(fields),
      });
      const row = get.get(id);
      maybeAlert(cur, row);
      changed(row);
      return toTeam(row);
    },

    remove(user, id) {
      if (user.role === "staff") throw forbidden("supervisorOnly");
      mustEdit(user);
      const cur = get.get(id);
      if (!cur) throw notFound();
      db.prepare("DELETE FROM generators WHERE id = ?").run(id);
      audit.log(user, "generator.delete", {
        targetType: "generator",
        targetId: id,
        service: "electricity",
        detail: { area: cur.area, name: cur.name },
      });
      changed(cur);
    },

    /* A new private link for the owner. Only its hash is kept, so the team
       sees the link once, to send it on; the old link stops working.     */
    newLink(user, id) {
      mustEdit(user);
      const cur = get.get(id);
      if (!cur) throw notFound();
      const key = randomToken(24);
      db.prepare("UPDATE generators SET key_hash = ? WHERE id = ?").run(sha256(key), id);
      audit.log(user, "generator.link", { targetType: "generator", targetId: id, service: "electricity" });
      return { key };
    },

    endLink(user, id) {
      mustEdit(user);
      db.prepare("UPDATE generators SET key_hash = NULL WHERE id = ?").run(id);
      audit.log(user, "generator.unlink", { targetType: "generator", targetId: id, service: "electricity" });
    },

    // The owner's page: their generator, found by the key in their link
    // A removed generator's link stops working, so an owner can't bring it back
    forOwner(key) {
      const g = key ? byKey.get(sha256(String(key))) : null;
      if (!g || g.status === "removed") throw notFound("badLink");
      return { generator: toPublic(g), official: this.officialFor(g.area) };
    },

    ownerUpdate(key, input) {
      const g = key ? byKey.get(sha256(String(key))) : null;
      if (!g || g.status === "removed") throw notFound("badLink");
      if (limits.count("generator", g.id, HOUR) >= GENERATOR_RULES.ownerUpdatesPerHour) throw tooMany("wait");
      limits.record("generator", g.id);
      const fields = readStatus(input, g.area);
      // an owner can't take their generator off the site; the team does that
      if (fields.status === "removed") throw badRequest("badStatus");
      save(g.id, fields, "owner");
      audit.log(null, "generator.owner", {
        targetType: "generator",
        targetId: g.id,
        service: "electricity",
        detail: Object.keys(fields),
      });
      const row = get.get(g.id);
      maybeAlert(g, row);
      changed(row);
      return toPublic(row);
    },

    /* ---- the committee's monthly price ---- */

    setOfficial(user, input) {
      if (user.role === "staff") throw forbidden("supervisorOnly");
      mustEdit(user);
      if (!isCity(input.city)) throw badRequest("badCity");
      const month = String(input.month || "");
      if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) throw badRequest("badMonth");
      const price = readPrice(input.price);
      if (price == null || price === 0) throw badRequest("badPrice");
      const hours = input.hours === "" || input.hours == null ? null : Math.round(Number(input.hours));
      if (hours != null && (!Number.isFinite(hours) || hours < 1 || hours > 744)) throw badRequest("badHours");
      db.prepare(
        `INSERT INTO generator_prices (city, month, price, hours, source, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(city, month) DO UPDATE SET price = excluded.price, hours = excluded.hours, source = excluded.source,
          set_by = excluded.set_by, set_at = excluded.set_at`,
      ).run(input.city, month, price, hours, clip(input.source, 200), user.id, now());
      audit.log(user, "generator.price", {
        targetType: "city",
        targetId: input.city,
        service: "electricity",
        detail: { month, price, hours },
      });
      live.publish("generators", { city: input.city });
      return this.officialPrices();
    },

    removeOfficial(user, city, month) {
      if (user.role === "staff") throw forbidden("supervisorOnly");
      mustEdit(user);
      db.prepare("DELETE FROM generator_prices WHERE city = ? AND month = ?").run(String(city), String(month));
      audit.log(user, "generator.price.delete", {
        targetType: "city",
        targetId: city,
        service: "electricity",
        detail: { month },
      });
      live.publish("generators", { city });
    },

    // The newest announced price per city, as long as it's for this month or last
    officialPrices() {
      const month = erbilDay(now()).slice(0, 7);
      const [y, m] = month.split("-").map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      const rows = db
        .prepare("SELECT * FROM generator_prices WHERE month IN (?, ?) ORDER BY month DESC")
        .all(month, prev);
      const out = {};
      for (const r of rows) {
        if (!out[r.city]) out[r.city] = { month: r.month, price: r.price, hours: r.hours, source: r.source };
      }
      return out;
    },

    teamPrices() {
      return db
        .prepare(
          "SELECT city, month, price, hours, source, set_at AS setAt FROM generator_prices ORDER BY month DESC, city",
        )
        .all();
    },

    officialFor(area) {
      return this.officialPrices()[cityOf(area)] || null;
    },
  };
}
