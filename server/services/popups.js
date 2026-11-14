/* © 2026 NorthPoint Tech. All rights reserved.

   Pop-up messages. An admin writes a short message (a title, a line or two,
   an optional link) in the languages they have, says from when until when,
   and it appears in a corner of every public page. Each visitor closes it
   once and it stays closed for them. Urgent ones look heavier.

   Only one is shown at a time: the newest that is running. An admin can
   take one down early. If they ask, the message also goes to every phone
   that gets alerts, once, in that phone's language.                     */
import { clip, langText } from "../lib/text.js";
import { badRequest, notFound } from "../lib/http.js";
import { fromJson } from "../db/index.js";
import { DAY } from "../lib/time.js";

export const POPUP_RULES = { longest: 30 * DAY, defaultLength: 3 * DAY };

export function createPopups({ db, live, push, sms = null, audit, now }) {
  const byId = db.prepare("SELECT * FROM popups WHERE id = ?");

  function out(p, t = now()) {
    const state = p.ended_at ? "ended" : p.starts_at > t ? "waiting" : p.ends_at <= t ? "over" : "on";
    return {
      id: p.id,
      kind: p.kind,
      title: fromJson(p.title),
      body: fromJson(p.body),
      link: p.link,
      from: p.starts_at,
      to: p.ends_at,
      endedAt: p.ended_at,
      pushed: p.pushed,
      createdAt: p.created_at,
      state,
    };
  }
  // What the public site gets: no names, no counts
  const forPublic = (p) => ({
    id: p.id,
    kind: p.kind,
    title: fromJson(p.title),
    body: fromJson(p.body),
    link: p.link,
    to: p.ends_at,
  });

  function read(input) {
    const title = langText(input.title, 90);
    if (!title) throw badRequest("needTitle");
    const body = langText(input.body, 280);
    let link = clip(input.link, 300) || null;
    if (link && !/^https:\/\/\S+$/.test(link) && !/^\/[\w\-./?=&#%]*$/.test(link)) throw badRequest("badUrl");
    const t = now();
    const from = Number(input.from) || t;
    const to = Number(input.to) || from + POPUP_RULES.defaultLength;
    if (to <= from) throw badRequest("endsBeforeStart");
    if (to < t) throw badRequest("alreadyOver");
    if (to - from > POPUP_RULES.longest) throw badRequest("tooLong");
    return { kind: input.kind === "urgent" ? "urgent" : "info", title, body, link, from, to };
  }

  return {
    // The one to show now, or null
    current() {
      const t = now();
      const p = db
        .prepare(
          "SELECT * FROM popups WHERE ended_at IS NULL AND starts_at <= ? AND ends_at > ? ORDER BY starts_at DESC, id DESC LIMIT 1",
        )
        .get(t, t);
      return p ? forPublic(p) : null;
    },

    // Newest first; `before` pages back through older ones
    list({ before = null, limit = 20 } = {}) {
      const rows = db
        .prepare(`SELECT * FROM popups ${before ? "WHERE id < ?" : ""} ORDER BY id DESC LIMIT ?`)
        .all(...(before ? [Number(before), limit + 1] : [limit + 1]));
      const more = rows.length > limit;
      return {
        popups: rows.slice(0, limit).map((p) => out(p)),
        more,
        total: db.prepare("SELECT COUNT(*) FROM popups").pluck().get(),
      };
    },

    async create(user, input) {
      const p = read(input);
      const t = now();
      const { lastInsertRowid: id } = db
        .prepare(
          `INSERT INTO popups (kind, title, body, link, starts_at, ends_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(p.kind, JSON.stringify(p.title), p.body ? JSON.stringify(p.body) : null, p.link, p.from, p.to, user.id, t);
      let pushed = null;
      if (input.push) {
        pushed = await push.broadcast({ id, kind: p.kind, title: p.title, body: p.body, link: p.link });
        db.prepare("UPDATE popups SET pushed = ? WHERE id = ?").run(pushed, id);
      }
      let texted = null;
      if (input.sms && sms && sms.info().enabled) texted = await sms.broadcast({ id, title: p.title, body: p.body });
      audit.log(user, "popup.create", {
        targetType: "popup",
        targetId: id,
        detail: { title: p.title.en || Object.values(p.title)[0], kind: p.kind, pushed, texted },
      });
      live.publish("popup", { id });
      return out(byId.get(id));
    },

    end(user, id) {
      const p = byId.get(Number(id));
      if (!p) throw notFound();
      if (!p.ended_at) {
        db.prepare("UPDATE popups SET ended_at = ?, ended_by = ? WHERE id = ?").run(now(), user.id, p.id);
        audit.log(user, "popup.end", {
          targetType: "popup",
          targetId: p.id,
          detail: { title: fromJson(p.title).en || Object.values(fromJson(p.title))[0] },
        });
        live.publish("popup", { id: p.id });
      }
      return out(byId.get(p.id));
    },

    audienceSize: () => db.prepare("SELECT COUNT(*) FROM push_subscriptions WHERE general = 1").pluck().get(),
    textSize: () => (sms && sms.info().enabled ? sms.count() : null),

    // Pop-ups that finished over a year ago are deleted
    prune() {
      return db.prepare("DELETE FROM popups WHERE ends_at < ?").run(now() - 365 * DAY).changes;
    },
  };
}
