/* © 2026 NorthPoint Tech. All rights reserved.

   Live chats with a real person.

   The assistant answers most questions by itself. When something is
   dangerous, has gone on for days, or the person is clearly stuck, it
   offers to put them through to their service's team. The chat shows up
   on the team page straight away, and replies come back live.

   Who can read a chat
     the resident  only from the browser that started it: it holds a random
                   key in an httpOnly cookie, and we keep only the key's hash
     the team      staff of that service, and admins
   Nobody else, and chats never appear on the public live stream.

   A chat closes when either side ends it, or after 6 hours without a
   message. Closed chats are deleted after 30 days.                      */
import { randomToken, sha256, newRef } from "../lib/crypto.js";
import { plainText, LANGS } from "../lib/text.js";
import { isArea } from "../lib/places.js";
import { badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { MINUTE, HOUR, DAY } from "../lib/time.js";

export const CHAT_RULES = {
  startsPerHour: 3,
  messagesPer10Min: 30,
  maxLength: 1000,
  idleClose: 6 * HOUR,
  keepClosed: 30 * DAY,
};
const REASONS = ["danger", "long", "stuck", "asked"];
const SERVICES = ["electricity", "water"];

export function createChats({ db, limits, live, audit, now }) {
  const byId = db.prepare("SELECT * FROM chats WHERE id = ?");
  const byKey = db.prepare("SELECT * FROM chats WHERE key_hash = ?");
  const messages = db.prepare(`SELECT m.id, m.at, m.sender, m.body, u.display_name FROM chat_messages m
    LEFT JOIN users u ON u.id = m.user_id WHERE m.chat_id = ? AND m.id > ? ORDER BY m.id`);
  const userName = db.prepare("SELECT display_name FROM users WHERE id = ?").pluck();
  const insertMessage = db.prepare(
    "INSERT INTO chat_messages (chat_id, at, sender, user_id, body) VALUES (?, ?, ?, ?, ?)",
  );

  // Residents see the team member's first name only
  const firstName = (name) =>
    String(name || "")
      .trim()
      .split(/\s+/)[0] || null;

  function forResident(c, after = 0) {
    return {
      ref: c.ref,
      service: c.service,
      area: c.area,
      status: c.status,
      lang: c.lang,
      closedBy: c.closed_by,
      answeredBy: c.assigned_to ? firstName(userName.get(c.assigned_to)) : null,
      online: live.teamOnline(c.service),
      messages: messages
        .all(c.id, after)
        .filter((m) => m.sender !== "note")
        .map((m) => ({
          id: m.id,
          at: m.at,
          from: m.sender,
          name: m.sender === "team" ? firstName(m.display_name) : null,
          body: m.body,
        })),
    };
  }

  function forTeam(c, { withMessages = false } = {}) {
    const last = db
      .prepare("SELECT sender, body, at FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1")
      .get(c.id);
    const unread = db
      .prepare("SELECT COUNT(*) FROM chat_messages WHERE chat_id = ? AND sender = 'resident' AND at > ?")
      .pluck()
      .get(c.id, c.team_seen_at || 0);
    const out = {
      id: c.id,
      ref: c.ref,
      service: c.service,
      area: c.area,
      reason: c.reason,
      lang: c.lang,
      status: c.status,
      assignedTo: c.assigned_to,
      assignedName: c.assigned_to ? userName.get(c.assigned_to) : null,
      createdAt: c.created_at,
      lastAt: c.last_message_at,
      firstResponseAt: c.first_response_at,
      closedAt: c.closed_at,
      closedBy: c.closed_by,
      last: last ? { from: last.sender, body: last.body.slice(0, 140), at: last.at } : null,
      unread,
    };
    if (withMessages) {
      out.messages = messages
        .all(c.id, 0)
        .map((m) => ({ id: m.id, at: m.at, from: m.sender, name: m.display_name, body: m.body }));
    }
    return out;
  }

  function teamCan(user, c) {
    if (user.role !== "admin" && user.service !== c.service) throw forbidden("otherService");
  }

  function chatWhere(user, status, service) {
    const svc = user.role === "admin" ? service : user.service;
    const w = [status === "closed" ? "status = 'closed'" : "status != 'closed'"],
      args = [];
    if (svc) {
      w.push("service = ?");
      args.push(svc);
    }
    return { sql: w.join(" AND "), args };
  }

  const tell = (c) => live.publish("chat", { service: c.service, chat: c.id }, { chat: true });

  function text(raw) {
    const body = plainText(raw, CHAT_RULES.maxLength);
    if (!body) throw badRequest("needMessage");
    return body;
  }

  return {
    /* ---------------- residents ---------------- */

    // Start a chat. `context` is what they asked the assistant, so they don't have to repeat it.
    start(input, who) {
      const service = SERVICES.includes(input.service) ? input.service : null;
      if (!service) throw badRequest("needService");
      const reason = REASONS.includes(input.reason) ? input.reason : "asked";
      const area = input.area && isArea(input.area) ? input.area : null;
      const lang = LANGS.includes(input.lang) ? input.lang : "en";
      if (limits.count("chat:start", who.device, HOUR) >= CHAT_RULES.startsPerHour) throw tooMany("slowDown");
      if (limits.count("chat:start:ip", who.ip, HOUR) >= CHAT_RULES.startsPerHour * 10) throw tooMany("slowDown");
      const first = text(input.message);
      const context = plainText(input.context, 300);

      const key = randomToken();
      const t = now();
      let id;
      db.transaction(() => {
        id = db
          .prepare(
            `INSERT INTO chats (ref, key_hash, service, area, reason, lang, device_hash, ip_hash, created_at, last_message_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(newRef(), sha256(key), service, area, reason, lang, who.device, who.ip, t, t).lastInsertRowid;
        if (context && context !== first) insertMessage.run(id, t, "note", null, context);
        insertMessage.run(id, t, "resident", null, first);
      })();
      limits.record("chat:start", who.device);
      limits.record("chat:start:ip", who.ip);
      const c = byId.get(id);
      tell(c);
      return { key, chat: forResident(c) };
    },

    // The chat this browser holds, or null. `after` = the last message id it has.
    mine(key, after = 0) {
      if (!key) return null;
      const c = byKey.get(sha256(key));
      if (!c) return null;
      if (c.status === "closed" && now() - c.closed_at > DAY) return null; // a day later it's gone from their side
      return forResident(c, Number(after) || 0);
    },

    // The chat row for a live connection, or null
    rowForKey(key) {
      return key ? byKey.get(sha256(key)) || null : null;
    },

    residentSays(key, raw) {
      const c = key && byKey.get(sha256(key));
      if (!c) throw notFound();
      if (c.status === "closed") throw forbidden("chatClosed");
      if (limits.count("chat:msg", String(c.id), 10 * MINUTE) >= CHAT_RULES.messagesPer10Min) throw tooMany("slowDown");
      const body = text(raw);
      const t = now();
      insertMessage.run(c.id, t, "resident", null, body);
      db.prepare("UPDATE chats SET last_message_at = ? WHERE id = ?").run(t, c.id);
      limits.record("chat:msg", String(c.id));
      tell(c);
      return forResident(byId.get(c.id));
    },

    residentEnds(key) {
      const c = key && byKey.get(sha256(key));
      if (!c) throw notFound();
      if (c.status !== "closed") {
        db.prepare("UPDATE chats SET status = 'closed', closed_at = ?, closed_by = 'resident' WHERE id = ?").run(
          now(),
          c.id,
        );
        tell(c);
      }
      return forResident(byId.get(c.id));
    },

    /* ---------------- the team ---------------- */

    // 50 at a time, waiting ones first; count() says how many in all
    list(user, { status = "active", service = null, offset = 0 } = {}) {
      const { sql, args } = chatWhere(user, status, service);
      return db
        .prepare(
          `SELECT * FROM chats WHERE ${sql} ORDER BY status = 'waiting' DESC, last_message_at DESC LIMIT 50 OFFSET ?`,
        )
        .all(...args, offset)
        .map((c) => forTeam(c));
    },
    count(user, { status = "active", service = null } = {}) {
      const { sql, args } = chatWhere(user, status, service);
      return db
        .prepare(`SELECT COUNT(*) FROM chats WHERE ${sql}`)
        .pluck()
        .get(...args);
    },

    counts(user, service = null) {
      const svc = user.role === "admin" ? service : user.service;
      const row = db
        .prepare(
          `SELECT SUM(status = 'waiting') AS waiting, SUM(status = 'open') AS open FROM chats WHERE status != 'closed' ${svc ? "AND service = ?" : ""}`,
        )
        .get(...(svc ? [svc] : []));
      return { waiting: row.waiting || 0, open: row.open || 0 };
    },

    open(user, id) {
      const c = byId.get(Number(id));
      if (!c) throw notFound();
      teamCan(user, c);
      if (!c.team_seen_at)
        audit.log(user, "chat.view", {
          targetType: "chat",
          targetId: c.id,
          service: c.service,
          detail: { ref: c.ref },
        });
      db.prepare("UPDATE chats SET team_seen_at = ? WHERE id = ?").run(now(), c.id);
      return forTeam(byId.get(c.id), { withMessages: true });
    },

    // A reply. The first one takes the chat: it's theirs from then on, unless someone else takes it over.
    teamSays(user, id, raw) {
      const c = byId.get(Number(id));
      if (!c) throw notFound();
      teamCan(user, c);
      if (c.status === "closed") throw forbidden("chatClosed");
      const body = text(raw);
      const t = now();
      insertMessage.run(c.id, t, "team", user.id, body);
      db.prepare(
        `UPDATE chats SET status = 'open', last_message_at = ?, team_seen_at = ?, assigned_to = COALESCE(assigned_to, ?),
        first_response_at = COALESCE(first_response_at, ?) WHERE id = ?`,
      ).run(t, t, user.id, t, c.id);
      if (!c.first_response_at)
        audit.log(user, "chat.answer", {
          targetType: "chat",
          targetId: c.id,
          service: c.service,
          detail: { ref: c.ref },
        });
      tell(c);
      return forTeam(byId.get(c.id), { withMessages: true });
    },

    take(user, id) {
      const c = byId.get(Number(id));
      if (!c) throw notFound();
      teamCan(user, c);
      db.prepare("UPDATE chats SET assigned_to = ? WHERE id = ?").run(user.id, c.id);
      audit.log(user, "chat.take", { targetType: "chat", targetId: c.id, service: c.service, detail: { ref: c.ref } });
      tell(c);
      return forTeam(byId.get(c.id), { withMessages: true });
    },

    close(user, id) {
      const c = byId.get(Number(id));
      if (!c) throw notFound();
      teamCan(user, c);
      if (c.status !== "closed") {
        db.prepare("UPDATE chats SET status = 'closed', closed_at = ?, closed_by = 'team' WHERE id = ?").run(
          now(),
          c.id,
        );
        audit.log(user, "chat.close", {
          targetType: "chat",
          targetId: c.id,
          service: c.service,
          detail: { ref: c.ref },
        });
        tell(c);
      }
      return forTeam(byId.get(c.id), { withMessages: true });
    },

    /* ---------------- housekeeping ---------------- */

    prune() {
      const t = now();
      const idle = db
        .prepare("SELECT id, service FROM chats WHERE status != 'closed' AND last_message_at < ?")
        .all(t - CHAT_RULES.idleClose);
      for (const c of idle) {
        db.prepare("UPDATE chats SET status = 'closed', closed_at = ?, closed_by = 'idle' WHERE id = ?").run(t, c.id);
        live.publish("chat", { service: c.service, chat: c.id }, { chat: true });
      }
      const gone = db
        .prepare("DELETE FROM chats WHERE status = 'closed' AND closed_at < ?")
        .run(t - CHAT_RULES.keepClosed).changes;
      return { closed: idle.length, deleted: gone };
    },
  };
}
