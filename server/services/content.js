/* © 2026 NorthPoint Tech. All rights reserved.
   What the teams publish: planned cuts (notices) and news headlines. */
import { fromJson } from "../db/index.js";
import { isArea } from "../lib/places.js";
import { clip, langText, isHttpsUrl, LANGS } from "../lib/text.js";
import { newId } from "../lib/crypto.js";
import { badRequest, notFound, forbidden } from "../lib/http.js";
import { HOUR, DAY, erbilDay } from "../lib/time.js";

const ALERT_AHEAD = 12 * HOUR; // alert people this long before a cut starts

export function createContent({ db, live, push, audit, now }) {
  /* ---------------- planned cuts ---------------- */

  function noticeOut(n) {
    return {
      id: n.id,
      service: n.service,
      areas: fromJson(n.areas, []),
      from: n.starts_at,
      to: n.ends_at,
      reason: fromJson(n.reason),
      source: fromJson(n.source),
    };
  }

  function readNotice(input) {
    const areas =
      Array.isArray(input.areas) && input.areas.includes("all")
        ? ["all"]
        : [...new Set((input.areas || []).filter(isArea))];
    const from = Number(input.from);
    const to = Number(input.to);
    if (!areas.length) throw badRequest("needAreas");
    if (!(from > 0) || !(to > from)) throw badRequest("badTime");
    if (to - from > 14 * DAY) throw badRequest("tooLong");
    const reason = langText(input.reason, 240);
    if (!reason) throw badRequest("needReason");
    return { areas, from, to, reason, source: langText(input.source, 80) };
  }

  const getNotice = db.prepare("SELECT * FROM notices WHERE id = ?");

  function ownNotice(user, id) {
    const n = getNotice.get(String(id));
    if (!n) throw notFound();
    if (user.role !== "admin" && n.service !== user.service) throw forbidden("notYours");
    return n;
  }

  // Alert now if the cut starts soon; otherwise the hourly job does it later.
  function maybeAlert(row) {
    if (row.alerted_at || row.ends_at < now() || row.starts_at - now() > ALERT_AHEAD) return;
    db.prepare("UPDATE notices SET alerted_at = ? WHERE id = ?").run(now(), row.id);
    push
      .plannedCut({ ...noticeOut(row), id: row.id + ":" + row.starts_at })
      .catch((e) => console.error("[push] planned cut alert failed:", e.message));
  }

  /* ---------------- news ---------------- */

  function newsOut(n) {
    return {
      id: n.id,
      service: n.service,
      date: n.date,
      outlet: n.outlet,
      url: n.url,
      title: n.title,
      lang: n.lang || "en",
      head: fromJson(n.heads),
      sum: fromJson(n.summary),
    };
  }

  function readNews(input) {
    const title = clip(input.title, 200);
    if (!title) throw badRequest("needTitle");
    const url = clip(input.url, 400);
    if (url && !isHttpsUrl(url)) throw badRequest("badUrl");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : erbilDay(now());
    const lang = LANGS.includes(input.lang) ? input.lang : "en";
    const head = langText(input.head, 200);
    if (head) delete head[lang]; // the original is already the title
    return {
      title,
      url,
      date,
      lang,
      outlet: clip(input.outlet, 80),
      summary: langText(input.sum, 300),
      heads: head && Object.keys(head).length ? head : null,
    };
  }

  const getNews = db.prepare("SELECT * FROM news WHERE id = ?");
  function ownNews(user, id) {
    const n = getNews.get(String(id));
    if (!n) throw notFound();
    if (user.role !== "admin" && n.service !== user.service) throw forbidden("notYours");
    return n;
  }

  return {
    publicNotices() {
      return db
        .prepare("SELECT * FROM notices WHERE ends_at > ? ORDER BY starts_at")
        .all(now() - HOUR)
        .map(noticeOut);
    },
    teamNotices(service) {
      const since = now() - 30 * DAY;
      const rows = service
        ? db
            .prepare("SELECT * FROM notices WHERE service = ? AND ends_at > ? ORDER BY starts_at DESC")
            .all(service, since)
        : db.prepare("SELECT * FROM notices WHERE ends_at > ? ORDER BY starts_at DESC").all(since);
      return rows.map((n) => ({
        ...noticeOut(n),
        alertedAt: n.alerted_at,
        createdBy: n.created_by,
        updatedAt: n.updated_at,
      }));
    },

    createNotice(user, service, input) {
      const n = readNotice(input);
      const id = newId("n");
      const t = now();
      db.prepare(
        `INSERT INTO notices (id, service, areas, starts_at, ends_at, reason, source, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        service,
        JSON.stringify(n.areas),
        n.from,
        n.to,
        JSON.stringify(n.reason),
        n.source ? JSON.stringify(n.source) : null,
        user.id,
        t,
        t,
      );
      audit.log(user, "notice.create", {
        targetType: "notice",
        targetId: id,
        service,
        detail: { areas: n.areas, from: n.from, to: n.to },
      });
      const row = getNotice.get(id);
      maybeAlert(row);
      live.publish("notices", { service, id });
      return noticeOut(row);
    },

    updateNotice(user, id, input) {
      const cur = ownNotice(user, id);
      const n = readNotice(input);
      const moved = n.from !== cur.starts_at;
      db.prepare(
        `UPDATE notices SET areas = ?, starts_at = ?, ends_at = ?, reason = ?, source = ?, updated_at = ?
        ${moved ? ", alerted_at = NULL" : ""} WHERE id = ?`,
      ).run(
        JSON.stringify(n.areas),
        n.from,
        n.to,
        JSON.stringify(n.reason),
        n.source ? JSON.stringify(n.source) : null,
        now(),
        cur.id,
      );
      audit.log(user, "notice.update", {
        targetType: "notice",
        targetId: cur.id,
        service: cur.service,
        detail: { areas: n.areas, from: n.from, to: n.to },
      });
      const row = getNotice.get(cur.id);
      maybeAlert(row);
      live.publish("notices", { service: cur.service, id: cur.id });
      return noticeOut(row);
    },

    deleteNotice(user, id) {
      const cur = ownNotice(user, id);
      if (user.role === "staff" && cur.created_by !== user.id) throw forbidden("supervisorOnly");
      db.prepare("DELETE FROM notices WHERE id = ?").run(cur.id);
      audit.log(user, "notice.delete", {
        targetType: "notice",
        targetId: cur.id,
        service: cur.service,
        detail: { areas: fromJson(cur.areas, []) },
      });
      live.publish("notices", { service: cur.service, id: cur.id });
    },

    // Called by the hourly job: alert for cuts that are now close
    alertUpcoming() {
      const rows = db
        .prepare("SELECT * FROM notices WHERE alerted_at IS NULL AND ends_at > ? AND starts_at < ?")
        .all(now(), now() + ALERT_AHEAD);
      rows.forEach(maybeAlert);
      return rows.length;
    },

    // The newest 30 travel with the live state; older ones come a page at a time (newsPage)
    publicNews() {
      return db.prepare("SELECT * FROM news ORDER BY date DESC, created_at DESC LIMIT 30").all().map(newsOut);
    },
    newsCount(service = null) {
      return service
        ? db.prepare("SELECT COUNT(*) FROM news WHERE service = ?").pluck().get(service)
        : db.prepare("SELECT COUNT(*) FROM news").pluck().get();
    },
    newsPage({ service = null, offset = 0, limit = 30 } = {}) {
      const rows = db
        .prepare(
          `SELECT * FROM news ${service ? "WHERE service = ?" : ""} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
        )
        .all(...(service ? [service] : []), limit, offset);
      return { items: rows.map(newsOut), total: this.newsCount(service) };
    },
    teamNews(service, { offset = 0 } = {}) {
      return this.newsPage({ service, offset, limit: 60 }).items;
    },

    createNews(user, service, input) {
      const n = readNews(input);
      const id = newId("w");
      const t = now();
      db.prepare(
        `INSERT INTO news (id, service, date, outlet, url, title, lang, heads, summary, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        service,
        n.date,
        n.outlet,
        n.url,
        n.title,
        n.lang,
        n.heads ? JSON.stringify(n.heads) : null,
        n.summary ? JSON.stringify(n.summary) : null,
        user.id,
        t,
        t,
      );
      audit.log(user, "news.create", { targetType: "news", targetId: id, service, detail: { title: n.title } });
      live.publish("news", { service, id });
      return newsOut(getNews.get(id));
    },

    updateNews(user, id, input) {
      const cur = ownNews(user, id);
      const n = readNews(input);
      db.prepare(
        "UPDATE news SET date = ?, outlet = ?, url = ?, title = ?, lang = ?, heads = ?, summary = ?, updated_at = ? WHERE id = ?",
      ).run(
        n.date,
        n.outlet,
        n.url,
        n.title,
        n.lang,
        n.heads ? JSON.stringify(n.heads) : null,
        n.summary ? JSON.stringify(n.summary) : null,
        now(),
        cur.id,
      );
      audit.log(user, "news.update", {
        targetType: "news",
        targetId: cur.id,
        service: cur.service,
        detail: { title: n.title },
      });
      live.publish("news", { service: cur.service, id: cur.id });
      return newsOut(getNews.get(cur.id));
    },

    deleteNews(user, id) {
      const cur = ownNews(user, id);
      if (user.role === "staff" && cur.created_by !== user.id) throw forbidden("supervisorOnly");
      db.prepare("DELETE FROM news WHERE id = ?").run(cur.id);
      audit.log(user, "news.delete", {
        targetType: "news",
        targetId: cur.id,
        service: cur.service,
        detail: { title: cur.title },
      });
      live.publish("news", { service: cur.service, id: cur.id });
    },

    prune() {
      return db.prepare("DELETE FROM notices WHERE ends_at < ?").run(now() - 90 * DAY).changes;
    },
  };
}
