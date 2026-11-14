/* © 2026 NorthPoint Tech. All rights reserved.

   Private requests: "only my house" or "my house and 2–3 others". That's
   usually a fuse, a meter or the nearest pole, so it doesn't belong on the
   public map. It goes to the right team with a phone number instead, and
   someone calls back to agree a time.

   Personal details (name, phone, landmark) are only ever shown to the
   team for that service. A request is deleted 30 days after it's done or
   cancelled, and after 60 days if nobody ever finished it.

   Residents can check on their request with the reference and the last
   four digits of their phone number.                                      */
import { isArea, isProblem } from "../lib/places.js";
import { plainText, cleanPhone, LANGS } from "../lib/text.js";
import { newId, newRef } from "../lib/crypto.js";
import { badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { MINUTE, DAY } from "../lib/time.js";

export const REQUEST_RULES = { gap: 2 * MINUTE, perDay: 3, ipPerDay: 60, lookupsPerHour: 20 };
export const STATUSES = ["new", "contacted", "scheduled", "done", "cancelled"];
const WHEN = ["any", "morning", "afternoon", "evening"];

export function createRequests({ db, limits, live, audit, now }) {
  const get = db.prepare("SELECT * FROM requests WHERE id = ?");
  const notesFor = db.prepare(`SELECT n.id, n.body, n.created_at, u.display_name FROM request_notes n
    LEFT JOIN users u ON u.id = n.user_id WHERE n.request_id = ? ORDER BY n.created_at`);
  const userName = db.prepare("SELECT display_name FROM users WHERE id = ?").pluck();

  function toTeam(r, { withNotes = false } = {}) {
    const out = {
      id: r.id,
      ref: r.ref,
      service: r.service,
      area: r.area,
      problem: r.problem,
      scope: r.scope,
      name: r.name,
      phone: r.phone,
      place: r.place,
      meter: r.meter,
      when: r.preferred_time,
      via: r.contact_via,
      note: r.note,
      lang: r.lang,
      status: r.status,
      visitAt: r.visit_at,
      assignedTo: r.assigned_to,
      assignedName: r.assigned_to ? userName.get(r.assigned_to) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      firstResponseAt: r.first_response_at,
      closedAt: r.closed_at,
    };
    if (withNotes)
      out.notes = notesFor.all(r.id).map((n) => ({ id: n.id, body: n.body, at: n.created_at, by: n.display_name }));
    return out;
  }

  function own(user, id) {
    const r = get.get(String(id));
    if (!r) throw notFound();
    if (user.role !== "admin" && r.service !== user.service) throw forbidden("notYours");
    return r;
  }

  function where(service, status) {
    const w = [],
      args = [];
    if (service) {
      w.push("service = ?");
      args.push(service);
    }
    if (status === "active") w.push("status IN ('new', 'contacted', 'scheduled')");
    else if (status === "closed") w.push("status IN ('done', 'cancelled')");
    else if (STATUSES.includes(status)) {
      w.push("status = ?");
      args.push(status);
    }
    return { sql: w.length ? "WHERE " + w.join(" AND ") : "", args };
  }

  return {
    create(body, who) {
      const service = String(body.service || "");
      const area = String(body.area || "");
      const problem = String(body.problem || "");
      if (!isArea(area) || !isProblem(service, problem)) throw badRequest();
      if (body.scope !== "home" && body.scope !== "few") throw badRequest();
      const phone = cleanPhone(body.phone);
      if (!phone) throw badRequest("needPhone");

      if (limits.count("request:ip", who.ip, DAY) >= REQUEST_RULES.ipPerDay) throw tooMany("tooManyPrivate");
      const since = limits.sinceLast("request", who.device);
      if (since < REQUEST_RULES.gap) throw tooMany("wait", { wait: Math.ceil((REQUEST_RULES.gap - since) / 1000) });
      if (limits.count("request", who.device, DAY) >= REQUEST_RULES.perDay) throw tooMany("tooManyPrivate");

      const t = now();
      const id = newId("q");
      let ref = newRef();
      while (db.prepare("SELECT 1 FROM requests WHERE ref = ?").get(ref)) ref = newRef();
      db.prepare(
        `INSERT INTO requests (id, ref, service, area, problem, scope, name, phone, place, meter, preferred_time, contact_via, note, lang, device, ip_hash, created_at, updated_at)
        VALUES (@id, @ref, @service, @area, @problem, @scope, @name, @phone, @place, @meter, @when, @via, @note, @lang, @device, @ip, @t, @t)`,
      ).run({
        id,
        ref,
        service,
        area,
        problem,
        scope: body.scope,
        name: plainText(body.name, 60),
        phone,
        place: plainText(body.place, 120),
        // digits (Western or Eastern Arabic), letters and dashes only, as printed on the bill
        meter: plainText(body.meter, 30)
          .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
          .replace(/[^\w-]/g, "")
          .slice(0, 24),
        when: WHEN.includes(body.when) ? body.when : "any",
        via: body.via === "call" ? "call" : "whatsapp",
        note: plainText(body.note, 280),
        lang: LANGS.includes(body.lang) ? body.lang : "en",
        device: who.device,
        ip: who.ip,
        t,
      });
      limits.record("request", who.device);
      limits.record("request:ip", who.ip);
      live.publish("requests", { service, id }, { teamOnly: true });
      return { ref, phone };
    },

    // Residents checking on their own request. Shows the status, nothing personal.
    status(ref, last4, who) {
      if (limits.count("lookup", who.ip, 60 * MINUTE) >= REQUEST_RULES.lookupsPerHour) throw tooMany();
      limits.record("lookup", who.ip);
      const r = db.prepare("SELECT * FROM requests WHERE ref = ?").get(
        String(ref || "")
          .trim()
          .toUpperCase(),
      );
      const digits = String(last4 || "")
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
        .replace(/\D/g, "");
      if (!r || digits.length !== 4 || !r.phone.endsWith(digits)) throw notFound("noRequest");
      return {
        ref: r.ref,
        service: r.service,
        area: r.area,
        status: r.status,
        visitAt: r.visit_at,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
      };
    },

    // 100 at a time, the ones needing action first; count() says how many there are in all
    list(service, { status = null, offset = 0 } = {}) {
      const { sql, args } = where(service, status);
      return db
        .prepare(
          `SELECT * FROM requests ${sql}
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END, created_at DESC LIMIT 100 OFFSET ?`,
        )
        .all(...args, offset)
        .map((r) => toTeam(r));
    },
    count(service, { status = null } = {}) {
      const { sql, args } = where(service, status);
      return db
        .prepare(`SELECT COUNT(*) FROM requests ${sql}`)
        .pluck()
        .get(...args);
    },

    detail(user, id) {
      const r = own(user, id);
      // Log who looked at someone's phone number, once per person per half hour
      const seen = db
        .prepare(`SELECT 1 FROM audit_log WHERE user_id = ? AND action = 'request.view' AND target_id = ? AND at > ?`)
        .get(user.id, r.id, now() - 30 * MINUTE);
      if (!seen)
        audit.log(user, "request.view", {
          targetType: "request",
          targetId: r.id,
          service: r.service,
          detail: { ref: r.ref },
        });
      return toTeam(r, { withNotes: true });
    },

    update(user, id, body) {
      const r = own(user, id);
      const t = now();
      const changes = {};
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) throw badRequest();
        changes.status = body.status;
      }
      if (body.visitAt !== undefined) {
        const v = body.visitAt === null ? null : Number(body.visitAt);
        if (v !== null && !(v > 0)) throw badRequest("badTime");
        changes.visit_at = v;
        if (v && !changes.status && (r.status === "new" || r.status === "contacted")) changes.status = "scheduled";
      }
      if (body.assignedTo !== undefined) {
        const a = body.assignedTo === null ? null : Number(body.assignedTo);
        if (a !== null) {
          const u = db.prepare("SELECT id, service, role, active FROM users WHERE id = ?").get(a);
          if (!u || !u.active || (u.role !== "admin" && u.service !== r.service)) throw badRequest("badUser");
        }
        changes.assigned_to = a;
      }

      db.transaction(() => {
        if (Object.keys(changes).length) {
          const sets = Object.keys(changes).map((k) => `${k} = @${k}`);
          if (changes.status && changes.status !== "new" && !r.first_response_at) sets.push("first_response_at = @t");
          if (changes.status)
            sets.push(["done", "cancelled"].includes(changes.status) ? "closed_at = @t" : "closed_at = NULL");
          db.prepare(`UPDATE requests SET ${sets.join(", ")}, updated_at = @t WHERE id = @id`).run({
            ...changes,
            t,
            id: r.id,
          });
        }
        const note = plainText(body.note, 500);
        if (note)
          db.prepare("INSERT INTO request_notes (request_id, user_id, body, created_at) VALUES (?, ?, ?, ?)").run(
            r.id,
            user.id,
            note,
            t,
          );
        if (note && !Object.keys(changes).length)
          db.prepare("UPDATE requests SET updated_at = ? WHERE id = ?").run(t, r.id);
      })();

      audit.log(user, "request.update", {
        targetType: "request",
        targetId: r.id,
        service: r.service,
        detail: {
          ref: r.ref,
          ...("status" in changes ? { status: changes.status } : {}),
          ...("visit_at" in changes ? { visitAt: changes.visit_at } : {}),
          ...("assigned_to" in changes ? { assignedTo: changes.assigned_to } : {}),
          ...(body.note ? { note: true } : {}),
        },
      });
      live.publish("requests", { service: r.service, id: r.id }, { teamOnly: true });
      return toTeam(get.get(r.id), { withNotes: true });
    },

    counts(service) {
      const rows = service
        ? db.prepare("SELECT status, COUNT(*) n FROM requests WHERE service = ? GROUP BY status").all(service)
        : db.prepare("SELECT status, COUNT(*) n FROM requests GROUP BY status").all();
      return Object.fromEntries(STATUSES.map((s) => [s, (rows.find((r) => r.status === s) || { n: 0 }).n]));
    },

    prune() {
      const t = now();
      return db
        .prepare(`DELETE FROM requests WHERE (status IN ('done', 'cancelled') AND closed_at < ?) OR created_at < ?`)
        .run(t - 30 * DAY, t - 60 * DAY).changes;
    },
  };
}
