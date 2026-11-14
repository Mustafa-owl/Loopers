/* © 2026 NorthPoint Tech. All rights reserved.

   Public reports and the "Me too" / "Fine here" taps.

   How a report earns trust
     • One person's report shows as "not confirmed yet". It never turns a
       neighbourhood red on its own.
     • A second person reporting the same thing (or tapping Me too), or the
       team confirming it, makes it confirmed.
     • "Fine here" closes it: one tap for a one- or two-person report,
       otherwise a third of the people who reported it, at least three.
     • Unconfirmed reports fade after 6 hours, confirmed ones after 24 hours
       with no new activity. After 7 days nothing links a report to a phone
       any more, and after 180 days it's deleted.

   Limits per phone: 1 report a minute, 5 an hour, 12 a day, from at most
   3 neighbourhoods a day, 40 taps an hour. Lots of phones in Erbil share
   one internet address on mobile data, so the limits per address are much
   looser (80 reports and 600 taps an hour).                               */
import { isArea, isProblem, isOutage, areaPoint } from "../lib/places.js";
import { cleanNote, clip } from "../lib/text.js";
import { newId } from "../lib/crypto.js";
import { HttpError, badRequest, notFound, tooMany, forbidden } from "../lib/http.js";
import { MINUTE, HOUR, DAY } from "../lib/time.js";

export const RULES = {
  gap: MINUTE,
  perHour: 5,
  perDay: 12,
  areasPerDay: 3,
  tapsPerHour: 40,
  /* Per internet address. Mobile networks put many phones behind one
     address, so on a citywide evening these can turn real people away
     (scripts/load-test.js --addresses 2 shows it). Both can be raised in
     .env: REPORTS_PER_ADDRESS_HOUR and TAPS_PER_ADDRESS_HOUR. */
  ipPerHour: Number(process.env.REPORTS_PER_ADDRESS_HOUR) || 80,
  ipTapsPerHour: Number(process.env.TAPS_PER_ADDRESS_HOUR) || 600,
  unconfirmedFor: 6 * HOUR,
  confirmedFor: DAY,
  // a new report joins an open one for as long as that one is open (6 h unconfirmed, 24 h confirmed)
  mergeWindow: DAY,
  keepFor: 7 * DAY, // then the link to a phone is removed
  historyFor: 180 * DAY, // then the report itself is deleted
};

export const fineNeeded = (people) => (people <= 2 ? 1 : Math.max(3, Math.ceil(people / 3)));

// what caused an outage, as the team records it
export const CAUSES = ["fault", "overload", "planned", "weather", "damage", "supply", "unknown"];

/* "18:30" in Erbil (UTC+3) as the next time it comes round, within a day */
function etrAt(hhmm, now) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  const erbil = new Date(now + 3 * 3600e3);
  let at = Date.UTC(erbil.getUTCFullYear(), erbil.getUTCMonth(), erbil.getUTCDate(), +m[1], +m[2]) - 3 * 3600e3;
  if (at <= now) at += 24 * 3600e3;
  return at;
}

/* The spot a resident shared, if it's believable: inside the Kurdistan
   Region and within 15 km of the place they chose. Otherwise ignored. */
function readSpot(spot, area) {
  if (!spot || typeof spot !== "object") return null;
  const lat = Number(spot.lat),
    lng = Number(spot.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 34.4 || lat > 37.5 || lng < 42.2 || lng > 46.5) return null;
  const a = areaPoint(area);
  if (a && Math.hypot((lat - a.lat) * 111, (lng - a.lng) * 89) > 15) return null;
  const acc = Number(spot.accuracy);
  return {
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    accuracy: Number.isFinite(acc) ? Math.min(Math.round(acc), 99999) : null,
  };
}

export function createReports({ db, limits, live, push, audit, photos, now }) {
  const get = db.prepare("SELECT * FROM reports WHERE id = ?");

  /* The facts about a report that follow from its row */
  function facts(r, t = now()) {
    const confirmed = r.people >= 2 || !!r.team_confirmed;
    const resolved = r.status === "closed" || r.fine >= fineNeeded(r.people);
    const alive = t - r.last_activity_at < (confirmed ? RULES.confirmedFor : RULES.unconfirmedFor);
    return { confirmed, resolved, alive, open: alive && !resolved && r.status !== "hidden" };
  }

  /* What the public sees. Same field names the pages have always used. */
  function toPublic(r, t = now()) {
    const f = facts(r, t);
    return {
      id: r.id,
      area: r.area,
      service: r.service,
      problem: r.problem,
      note: r.note ? { any: r.note } : null,
      started: r.started_at,
      last: r.last_activity_at,
      people: r.people,
      fine: r.fine,
      confirmed: f.confirmed,
      resolved: f.resolved,
      teamConfirmed: !!r.team_confirmed,
      teamClosed: r.status === "closed",
      teamNote: r.team_note || null,
      fixing: f.open && r.fixing_at ? r.fixing_at : null,
      // when the crew expects it back, while they're on it
      etr: f.open && r.fixing_at && r.etr_at ? r.etr_at : null,
      photos: photos.approvedFor(r.id),
    };
  }

  /* How many different internet addresses the people on a report came from.
     One phone can pretend to be several; a confirmed report whose people all
     came from one address is worth a second look before anyone drives out.
     Counted from the scrambled codes, and gone after 7 days with them.   */
  const addressesOf = db
    .prepare(
      `SELECT COUNT(DISTINCT ip) FROM (SELECT ip_hash AS ip FROM reports WHERE id = @id AND ip_hash IS NOT NULL
      UNION ALL SELECT ip_hash FROM votes WHERE report_id = @id AND kind = 'metoo' AND ip_hash IS NOT NULL)`,
    )
    .pluck();

  const spotsOf = db.prepare("SELECT lat, lng, accuracy, at FROM report_spots WHERE report_id = ? ORDER BY at, rowid");

  /* What a team sees: everything above, plus the status and timings. */
  function toTeam(r, t = now()) {
    const f = facts(r, t);
    return {
      ...toPublic(r, t),
      addresses: r.ip_hash ? addressesOf.get({ id: r.id }) : null,
      status: r.status,
      alive: f.alive,
      open: f.open,
      confirmedAt: r.confirmed_at,
      fixingAt: r.fixing_at,
      no: r.no,
      spots: spotsOf.all(r.id),
      crew: r.crew || null,
      cause: r.cause || null,
      resolvedAt: r.resolved_at,
      closedAt: r.closed_at,
      closedBy: r.closed_by,
      photos: photos.allFor(r.id),
    };
  }

  function listPublic() {
    const t = now();
    const since = t - RULES.confirmedFor;
    return db
      .prepare("SELECT * FROM reports WHERE status != 'hidden' AND last_activity_at > ? ORDER BY last_activity_at DESC")
      .all(since)
      .filter((r) => facts(r, t).alive)
      .map((r) => toPublic(r, t));
  }

  function listForTeam(service, { days = 7 } = {}) {
    const t = now();
    const rows = service
      ? db
          .prepare("SELECT * FROM reports WHERE service = ? AND last_activity_at > ? ORDER BY last_activity_at DESC")
          .all(service, t - days * DAY)
      : db
          .prepare("SELECT * FROM reports WHERE last_activity_at > ? ORDER BY last_activity_at DESC")
          .all(t - days * DAY);
    return rows.map((r) => toTeam(r, t));
  }

  // Did this device already send or "me too" this report?
  const voteOf = db.prepare("SELECT kind FROM votes WHERE report_id = ? AND device = ?").pluck();

  function checkSendLimits(who, area) {
    if (limits.count("report:ip", who.ip, HOUR) >= RULES.ipPerHour) throw tooMany();
    const since = limits.sinceLast("report", who.device);
    if (since < RULES.gap) throw tooMany("wait", { wait: Math.ceil((RULES.gap - since) / 1000) });
    if (
      limits.count("report", who.device, HOUR) >= RULES.perHour ||
      limits.count("report", who.device, DAY) >= RULES.perDay
    )
      throw tooMany();
    const areas = new Set(limits.distinct("report", who.device, DAY));
    if (!areas.has(area) && areas.size >= RULES.areasPerDay) throw tooMany("tooManyAreas");
  }

  /* Bumps confirmed_at / resolved_at the moment they become true, and
     returns what changed so we know whether to send alerts. */
  function settle(id, before) {
    const r = get.get(id);
    const t = now();
    const f = facts(r, t);
    if (f.confirmed && !r.confirmed_at) db.prepare("UPDATE reports SET confirmed_at = ? WHERE id = ?").run(t, id);
    if (f.resolved && r.status !== "closed" && !r.resolved_at)
      db.prepare("UPDATE reports SET resolved_at = ? WHERE id = ?").run(t, id);
    if (!f.resolved && r.resolved_at && r.status !== "closed")
      db.prepare("UPDATE reports SET resolved_at = NULL WHERE id = ?").run(id);
    const after = get.get(id);
    const becameConfirmedOutage =
      f.confirmed && !(before && before.confirmed) && isOutage(r.service, r.problem) && f.open;
    return { row: after, becameConfirmedOutage };
  }

  function announce(row, becameConfirmedOutage) {
    live.publish("reports", { service: row.service, area: row.area, id: row.id });
    if (becameConfirmedOutage)
      push.outage(toPublic(row)).catch((e) => console.error("[push] outage alert failed:", e.message));
  }

  return {
    facts,
    toPublic,
    toTeam,
    listPublic,
    listForTeam,
    get: (id) => get.get(id) || null,

    /* A resident sends a report. If the same problem is already open in that
       neighbourhood, theirs joins it as a "Me too" instead of a duplicate. */
    create(body, who) {
      const area = String(body.area || "");
      const service = String(body.service || "");
      const problem = String(body.problem || "");
      if (!isArea(area) || !isProblem(service, problem)) throw badRequest();
      const note = cleanNote(body.note);
      if (!note.ok) throw badRequest(note.reason);

      const t = now();
      // Already in this one? Say so before any limit, since nothing new is sent.
      const existing = db
        .prepare(
          `SELECT * FROM reports WHERE area = ? AND service = ? AND problem = ?
        AND status = 'open' AND last_activity_at > ? ORDER BY last_activity_at DESC`,
        )
        .all(area, service, problem, t - RULES.mergeWindow)
        .find((r) => facts(r, t).open);
      if (existing && (existing.created_by === who.device || voteOf.get(existing.id, who.device) === "metoo")) {
        throw new HttpError(409, "already", { id: existing.id });
      }
      checkSendLimits(who, area);

      const result = db.transaction(() => {
        const candidates = db
          .prepare(
            `SELECT * FROM reports WHERE area = ? AND service = ? AND problem = ?
          AND status = 'open' AND last_activity_at > ? ORDER BY last_activity_at DESC`,
          )
          .all(area, service, problem, t - RULES.mergeWindow);
        const open = candidates.find((r) => facts(r, t).open);
        if (open) {
          if (open.created_by === who.device || voteOf.get(open.id, who.device) === "metoo") {
            throw new HttpError(409, "already", { id: open.id });
          }
          const before = facts(open, t);
          const previous = voteOf.get(open.id, who.device);
          if (previous === "fine") db.prepare("UPDATE reports SET fine = fine - 1 WHERE id = ?").run(open.id);
          db.prepare(
            "INSERT INTO votes (report_id, device, kind, created_at, ip_hash) VALUES (?, ?, 'metoo', ?, ?) ON CONFLICT(report_id, device) DO UPDATE SET kind = 'metoo', created_at = excluded.created_at, ip_hash = excluded.ip_hash",
          ).run(open.id, who.device, t, who.ip);
          db.prepare("UPDATE reports SET people = people + 1, last_activity_at = ? WHERE id = ?").run(t, open.id);
          return { id: open.id, merged: true, ...settle(open.id, before) };
        }
        const id = newId("r");
        db.prepare(
          `INSERT INTO reports (id, area, service, problem, note, created_by, ip_hash, started_at, last_activity_at, no)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(no), 0) + 1 FROM reports))`,
        ).run(id, area, service, problem, note.note, who.device, who.ip, t, t);
        return { id, merged: false, ...settle(id, null) };
      })();

      const spot = readSpot(body.spot, area);
      if (spot)
        db.prepare(
          `INSERT INTO report_spots (report_id, device, lat, lng, accuracy, at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(report_id, device) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, at = excluded.at`,
        ).run(result.id, who.device, spot.lat, spot.lng, spot.accuracy, t);
      limits.record("report", who.device, area);
      limits.record("report:ip", who.ip);
      announce(result.row, result.becameConfirmedOutage);
      return { id: result.id, merged: result.merged, report: toPublic(result.row) };
    },

    /* "Me too" or "Fine here". Tapping the same one again takes it back. */
    vote(body, who) {
      const kind = body.kind;
      if (kind !== "metoo" && kind !== "fine") throw badRequest();
      if (
        limits.count("tap:ip", who.ip, HOUR) >= RULES.ipTapsPerHour ||
        limits.count("tap", who.device, HOUR) >= RULES.tapsPerHour
      )
        throw tooMany();
      const r = get.get(String(body.id || ""));
      // a report that has faded can't be brought back by a page that was left open
      if (!r || r.status === "hidden" || !facts(r).alive) throw notFound("gone");
      if (kind === "metoo" && r.created_by === who.device) throw forbidden("own");

      const t = now();
      const result = db.transaction(() => {
        const before = facts(r, t);
        const previous = voteOf.get(r.id, who.device);
        if (previous === "metoo") db.prepare("UPDATE reports SET people = people - 1 WHERE id = ?").run(r.id);
        if (previous === "fine") db.prepare("UPDATE reports SET fine = fine - 1 WHERE id = ?").run(r.id);
        let mine = null;
        if (previous === kind) {
          db.prepare("DELETE FROM votes WHERE report_id = ? AND device = ?").run(r.id, who.device);
        } else {
          db.prepare(
            "INSERT INTO votes (report_id, device, kind, created_at, ip_hash) VALUES (?, ?, ?, ?, ?) ON CONFLICT(report_id, device) DO UPDATE SET kind = excluded.kind, created_at = excluded.created_at, ip_hash = excluded.ip_hash",
          ).run(r.id, who.device, kind, t, who.ip);
          if (kind === "metoo")
            db.prepare("UPDATE reports SET people = people + 1, last_activity_at = ? WHERE id = ?").run(t, r.id);
          else db.prepare("UPDATE reports SET fine = fine + 1 WHERE id = ?").run(r.id);
          mine = kind;
        }
        return { mine, ...settle(r.id, before) };
      })();

      limits.record("tap", who.device);
      limits.record("tap:ip", who.ip);
      announce(result.row, result.becameConfirmedOutage);
      return { report: toPublic(result.row), myVote: result.mine };
    },

    // The reports this device sent or tapped, so a phone remembers after a reinstall
    mine(device) {
      return {
        sent: db
          .prepare("SELECT id FROM reports WHERE created_by = ? AND last_activity_at > ?")
          .pluck()
          .all(device, now() - RULES.keepFor),
        votes: Object.fromEntries(
          db
            .prepare("SELECT report_id, kind FROM votes WHERE device = ? AND created_at > ?")
            .raw()
            .all(device, now() - RULES.keepFor),
        ),
      };
    },

    /* Team actions on a report. `user` has already been checked for this
       service by the route; here we only check the role for hiding. */
    teamAction(user, id, body) {
      const r = get.get(String(id));
      if (!r) throw notFound();
      if (user.role !== "admin" && r.service !== user.service) throw forbidden("notYours");
      const action = body.action;
      const t = now();
      const before = facts(r, t);

      switch (action) {
        case "confirm":
          db.prepare("UPDATE reports SET team_confirmed = 1 - team_confirmed, last_activity_at = ? WHERE id = ?").run(
            t,
            r.id,
          );
          break;
        case "close":
          db.prepare("UPDATE reports SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ?").run(
            t,
            user.id,
            r.id,
          );
          break;
        case "reopen":
          db.transaction(() => {
            db.prepare("DELETE FROM votes WHERE report_id = ? AND kind = 'fine'").run(r.id);
            db.prepare(
              "UPDATE reports SET status = 'open', fine = 0, closed_at = NULL, closed_by = NULL, resolved_at = NULL, last_activity_at = ? WHERE id = ?",
            ).run(t, r.id);
          })();
          break;
        case "hide":
        case "unhide":
          if (user.role === "staff") throw forbidden("supervisorOnly");
          // unhiding puts it back as it was: a report the team had closed stays closed
          db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(
            action === "hide" ? "hidden" : r.closed_at ? "closed" : "open",
            r.id,
          );
          break;
        // "A crew is on it": only on something still open; pressing it again takes it back
        case "fixing":
          if (r.fixing_at)
            db.prepare(
              "UPDATE reports SET fixing_at = NULL, fixing_by = NULL, crew = NULL, etr_at = NULL WHERE id = ?",
            ).run(r.id);
          else if (before.open)
            db.prepare("UPDATE reports SET fixing_at = ?, fixing_by = ?, last_activity_at = ? WHERE id = ?").run(
              t,
              user.id,
              t,
              r.id,
            );
          else throw badRequest("notOpen");
          break;
        case "note":
          db.prepare("UPDATE reports SET team_note = ? WHERE id = ?").run(clip(body.note, 200) || null, r.id);
          break;
        // the crew, when they expect it back ("18:30", Erbil time) and the cause
        case "details": {
          const crew = clip(body.crew, 40) || null;
          const cause = body.cause == null || body.cause === "" ? null : String(body.cause);
          if (cause && !CAUSES.includes(cause)) throw badRequest("badCause");
          const etr = body.etr ? etrAt(String(body.etr), t) : null;
          if (body.etr && !etr) throw badRequest("badTime");
          db.prepare("UPDATE reports SET crew = ?, etr_at = ?, cause = ? WHERE id = ?").run(crew, etr, cause, r.id);
          break;
        }
        default:
          throw badRequest();
      }

      const { row, becameConfirmedOutage } = settle(r.id, before);
      audit.log(user, "report." + action, {
        targetType: "report",
        targetId: r.id,
        service: r.service,
        detail: {
          area: r.area,
          problem: r.problem,
          ...(action === "note" ? { note: row.team_note } : {}),
          ...(action === "details" ? { crew: row.crew, cause: row.cause } : {}),
        },
      });
      announce(row, becameConfirmedOutage);
      if (action === "fixing" && row.fixing_at)
        push.fixing(toPublic(row)).catch((e) => console.error("[push] fixing alert failed:", e.message));
      return toTeam(row);
    },

    /* After 7 days a report loses everything that links it to a phone (the
       device and address codes, and the taps). What's left, "no power in
       Ankawa from 20:10 to 23:40, 14 people", stays for the dashboard's
       charts and is deleted after 180 days. */
    prune() {
      const t = now();
      db.prepare("DELETE FROM votes WHERE report_id IN (SELECT id FROM reports WHERE last_activity_at < ?)").run(
        t - RULES.keepFor,
      );
      // the exact spots people shared go after 7 days too
      db.prepare("DELETE FROM report_spots WHERE at < ?").run(t - RULES.keepFor);
      // photos carry the same device code as the report; it goes at the same time
      db.prepare(
        "UPDATE photos SET uploaded_by = '' WHERE uploaded_by != '' AND report_id IN (SELECT id FROM reports WHERE last_activity_at < ?)",
      ).run(t - RULES.keepFor);
      db.prepare(
        "UPDATE reports SET created_by = '', ip_hash = NULL WHERE last_activity_at < ? AND created_by != ''",
      ).run(t - RULES.keepFor);
      return db.prepare("DELETE FROM reports WHERE last_activity_at < ?").run(t - RULES.historyFor).changes;
    },
  };
}
