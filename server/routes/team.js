/* © 2026 NorthPoint Tech. All rights reserved.

   The API behind the team page. Every route needs a signed-in team member,
   except signing in itself. A member only ever sees and changes their own
   service; admins see both.

     POST   /api/team/login              { username, password }
     POST   /api/team/logout
     GET    /api/team/me
     POST   /api/team/password           { current, next }

     GET    /api/team/overview           reports, cuts, news, request counts, photos to check
     POST   /api/team/reports/:id        { action: confirm | close | reopen | hide | unhide | note, note }

     GET    /api/team/requests?status=   private requests (active | closed | a status)
     GET    /api/team/requests/:id       one request with its notes
     PATCH  /api/team/requests/:id       { status, visitAt, assignedTo, note }

     POST   /api/team/notices            add a planned cut
     PUT    /api/team/notices/:id
     DELETE /api/team/notices/:id
     POST   /api/team/news               add a headline
     PUT    /api/team/news/:id
     DELETE /api/team/news/:id

     GET    /api/team/news/suggestions?status=   headlines found on the news sites (new | published | dismissed)
     POST   /api/team/news/suggestions/:id       { action: publish | dismiss, service }
     POST   /api/team/news/check                 look at the news sites now (supervisors and admins)
     GET    /api/team/news/sources               admins: the sites it looks at, and how each did
     POST   /api/team/news/sources               admins: add one { name, url, kind, pattern, trusted }
     PATCH  /api/team/news/sources/:id           admins: { active, trusted }
     DELETE /api/team/news/sources/:id           admins
     POST   /api/team/news/auto                  admins: { on } publish the clearest ones without asking

     GET    /api/team/popups?before=   admins: pop-up messages, newest first, and how many phones get alerts
     POST   /api/team/popups           admins: { popup: { kind, title, body, link, from, to, push } }
     POST   /api/team/popups/:id/end   admins: take it down now

     GET    /api/team/generators          generators, the committee's prices, and the cities
     POST   /api/team/generators          electricity team: add one
     PATCH  /api/team/generators/:id      electricity team: change it
     DELETE /api/team/generators/:id      supervisors and admins
     POST   /api/team/generators/:id/link    a new private link for the owner (shown once)
     POST   /api/team/generators/:id/unlink  stop the owner's link working
     POST   /api/team/generators/prices      supervisors and admins: { city, month, price, hours, source }
     DELETE /api/team/generators/prices/:city/:month

     GET    /api/team/sites                     everyone: substations, water plants, pumping stations, reservoirs, offices
     POST   /api/team/sites                     supervisors+: { kind, service, name, note?, spot: { lat, lng } }
     PATCH  /api/team/sites/:id                 supervisors+ of that service: any of the above
     DELETE /api/team/sites/:id                 supervisors+ of that service
     POST   /api/team/sites/import              admins: bring in the real ones mapped on OpenStreetMap
     GET    /api/team/words                     admins: reviewers, their progress, suggested changes
     POST   /api/team/words/reviewers           admins: { name, lang } a native speaker, with a private link (shown once)
     POST   /api/team/words/reviewers/:id/link  admins: a new link (the old one stops)
     POST   /api/team/words/reviewers/:id/end   admins: the link stops working

     GET    /api/team/photos/:id         the photo itself (also pending ones)
     POST   /api/team/photos/:id         { action: approve | reject }

     GET    /api/team/stats?days=        numbers for the dashboard
     GET    /api/team/audit?before=      activity log (supervisors and admins)
     GET    /api/team/export/reports     a spreadsheet (CSV) of reports, ?days=30
     GET    /api/team/export/requests    the same for requests (supervisors and admins)
     GET    /api/team/live               live updates for this team

     GET    /api/team/chats?status=      live chats with residents (active | closed)
     GET    /api/team/chats/:id          one chat with its messages
     POST   /api/team/chats/:id          { action: say | take | close, body }

     GET    /api/team/system             admins: is the site healthy, how fast, which errors
     POST   /api/team/system/errors/clear  admins: start the error list again

     GET    /api/team/users              admins: team accounts
     POST   /api/team/users              admins: add someone (returns a temporary password)
     PATCH  /api/team/users/:id          admins: change name, role, service, or switch off
     GET    /api/team/users/:id          admins: one account, its sessions and recent work
     POST   /api/team/users/:id/reset    admins: new temporary password      { confirm }
     POST   /api/team/users/:id/password admins: a password they chose   { password, mustChange, confirm }
     POST   /api/team/users/:id/signout  admins: end its sessions        { session?, confirm }
     POST   /api/team/users/:id/unlock   admins: clear a pause after wrong passwords
     POST   /api/team/users/:id/remove   admins: remove an account that was never used  { confirm }
     POST   /api/team/signout-everyone   admins: end every session but this one          { confirm }

   { confirm } is the admin's own password, asked again for these.          */
import express from "express";
import {
  loadUser,
  requireUser,
  requireRole,
  serviceFor,
  setSessionCookie,
  clearSessionCookie,
  readCookie,
  COOKIE,
} from "../middleware/auth.js";
import { sameSiteOnly } from "../middleware/security.js";
import { badRequest, notFound, forbidden, intParam } from "../lib/http.js";

export function teamRoutes(s) {
  const r = express.Router();
  r.use((_req, res, next) => {
    res.set("cache-control", "no-store");
    next();
  });
  r.use(sameSiteOnly);
  r.use(loadUser(s.users));

  /* ---------------- signing in ---------------- */

  r.post("/login", (req, res) => {
    const { token, user, expires } = s.users.login(req.body, req.who, req.get("user-agent"));
    setSessionCookie(res, token, expires);
    res.json({ ok: true, user, expires });
  });

  r.post("/logout", (req, res) => {
    if (req.user) s.audit.log(req.user, "logout");
    s.users.logout(readCookie(req, COOKIE));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  r.use(requireUser);

  r.get("/me", (req, res) => {
    const service = req.user.service || "electricity";
    res.json({ ok: true, user: s.users.toPublic(req.user), colleagues: s.users.assignable(service) });
  });

  r.post("/password", (req, res) => {
    res.json({ ok: true, user: s.users.changePassword(req.user, req.body) });
  });

  /* ---------------- the day's work ---------------- */

  r.get("/overview", (req, res) => {
    const service = serviceFor(req);
    res.json({
      ok: true,
      now: Date.now(),
      service,
      reports: s.reports.listForTeam(service, { days: intParam(req.query.days, { min: 1, max: 30, fallback: 7 }) }),
      notices: s.content.teamNotices(service),
      news: s.content.teamNews(service),
      newsTotal: s.content.newsCount(service),
      requests: s.requests.counts(service),
      chats: s.chats.counts(req.user, service),
      photos: s.photos.pending(service),
      colleagues: s.users.assignable(service || req.user.service || "electricity"),
    });
  });

  r.post("/reports/:id", (req, res) => {
    res.json({ ok: true, report: s.reports.teamAction(req.user, req.params.id, req.body) });
  });

  r.get("/requests", (req, res) => {
    const offset = intParam(req.query.offset, { min: 0, max: 100000, fallback: 0 });
    const status = req.query.status || "active";
    res.json({
      ok: true,
      requests: s.requests.list(serviceFor(req), { status, offset }),
      total: s.requests.count(serviceFor(req), { status }),
    });
  });

  r.get("/requests/:id", (req, res) => {
    res.json({ ok: true, request: s.requests.detail(req.user, req.params.id) });
  });

  r.patch("/requests/:id", (req, res) => {
    res.json({ ok: true, request: s.requests.update(req.user, req.params.id, req.body) });
  });

  /* ---------------- planned cuts and news ---------------- */

  r.post("/notices", (req, res) => {
    res.status(201).json({
      ok: true,
      notice: s.content.createNotice(req.user, serviceFor(req, { required: true }), req.body.notice || {}),
    });
  });
  r.put("/notices/:id", (req, res) => {
    res.json({ ok: true, notice: s.content.updateNotice(req.user, req.params.id, req.body.notice || {}) });
  });
  r.delete("/notices/:id", (req, res) => {
    s.content.deleteNotice(req.user, req.params.id);
    res.json({ ok: true });
  });

  // Found on the news sites. These come before /news/:id so "suggestions" isn't taken for an id.
  r.get("/news/suggestions", (req, res) => {
    const service = req.user.role === "admin" ? serviceFor(req) : req.user.service;
    const offset = intParam(req.query.offset, { min: 0, max: 100000, fallback: 0 });
    res.json({
      ok: true,
      ...s.newsfeed.suggestionsPage(req.user, { status: req.query.status, service, offset }),
      auto: s.newsfeed.autopublish(),
    });
  });
  r.post("/news/suggestions/:id", (req, res) => {
    res.json({ ok: true, ...s.newsfeed.decide(req.user, req.params.id, req.body) });
  });
  r.post("/news/check", requireRole("supervisor", "admin"), async (req, res, next) => {
    try {
      s.audit.log(req.user, "news.check");
      res.json({ ok: true, result: await s.newsfeed.run() });
    } catch (err) {
      next(err);
    }
  });
  r.get("/news/sources", requireRole("admin"), (_req, res) =>
    res.json({ ok: true, sources: s.newsfeed.sources(), auto: s.newsfeed.autopublish() }),
  );
  r.post("/news/sources", requireRole("admin"), (req, res) =>
    res.status(201).json({ ok: true, source: s.newsfeed.addSource(req.user, req.body.source || {}) }),
  );
  r.patch("/news/sources/:id", requireRole("admin"), (req, res) =>
    res.json({ ok: true, source: s.newsfeed.updateSource(req.user, req.params.id, req.body) }),
  );
  r.delete("/news/sources/:id", requireRole("admin"), (req, res) =>
    res.json({ ok: true, ...s.newsfeed.removeSource(req.user, req.params.id) }),
  );
  r.post("/news/auto", requireRole("admin"), (req, res) =>
    res.json({ ok: true, ...s.newsfeed.setAutopublish(req.user, !!req.body.on) }),
  );

  /* ---------------- neighbourhood generators ---------------- */
  /* the utilities' own places, for the maps */
  r.get("/sites", (_req, res) => res.json({ ok: true, sites: s.sites.list() }));
  r.post("/sites", (req, res) => res.status(201).json({ ok: true, site: s.sites.create(req.user, req.body || {}) }));
  r.post("/sites/import", requireRole("admin"), async (req, res) =>
    res.json({ ok: true, ...(await s.sites.importOsm(req.user)) }),
  );
  r.patch("/sites/:id", (req, res) =>
    res.json({ ok: true, site: s.sites.update(req.user, req.params.id, req.body || {}) }),
  );
  r.delete("/sites/:id", (req, res) => {
    s.sites.remove(req.user, req.params.id);
    res.json({ ok: true });
  });

  r.get("/generators", (_req, res) => {
    res.json({ ok: true, generators: s.generators.listTeam(), prices: s.generators.teamPrices() });
  });
  r.post("/generators", (req, res) => {
    res.status(201).json({ ok: true, generator: s.generators.create(req.user, req.body.generator || {}) });
  });
  r.post("/generators/prices", (req, res) => {
    res.json({
      ok: true,
      official: s.generators.setOfficial(req.user, req.body || {}),
      prices: s.generators.teamPrices(),
    });
  });
  r.delete("/generators/prices/:city/:month", (req, res) => {
    s.generators.removeOfficial(req.user, req.params.city, req.params.month);
    res.json({ ok: true, prices: s.generators.teamPrices() });
  });
  r.patch("/generators/:id", (req, res) => {
    res.json({ ok: true, generator: s.generators.update(req.user, req.params.id, req.body.generator || {}) });
  });
  r.delete("/generators/:id", (req, res) => {
    s.generators.remove(req.user, req.params.id);
    res.json({ ok: true });
  });
  r.post("/generators/:id/link", (req, res) => {
    res.json({ ok: true, ...s.generators.newLink(req.user, req.params.id) });
  });
  r.post("/generators/:id/unlink", (req, res) => {
    s.generators.endLink(req.user, req.params.id);
    res.json({ ok: true });
  });

  /* ---------------- native speakers (admins) ---------------- */
  r.get("/words", requireRole("admin"), (req, res) => res.json({ ok: true, ...s.words.teamView(req.user) }));
  r.post("/words/reviewers", requireRole("admin"), (req, res) =>
    res.status(201).json({ ok: true, ...s.words.addReviewer(req.user, req.body || {}) }),
  );
  r.post("/words/reviewers/:id/link", requireRole("admin"), (req, res) =>
    res.json({ ok: true, ...s.words.newLink(req.user, Number(req.params.id)) }),
  );
  r.post("/words/reviewers/:id/end", requireRole("admin"), (req, res) => {
    s.words.endReviewer(req.user, Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------------- pop-up messages (admins) ---------------- */
  r.get("/popups", requireRole("admin"), (req, res) => {
    res.json({
      ok: true,
      ...s.popups.list({ before: req.query.before || null }),
      phones: s.popups.audienceSize(),
      texts: s.popups.textSize(),
    });
  });
  r.post("/popups", requireRole("admin"), async (req, res, next) => {
    try {
      res.status(201).json({ ok: true, popup: await s.popups.create(req.user, req.body.popup || {}) });
    } catch (err) {
      next(err);
    }
  });
  r.post("/popups/:id/end", requireRole("admin"), (req, res) => {
    res.json({ ok: true, popup: s.popups.end(req.user, req.params.id) });
  });

  // the team's older news, 60 at a time
  r.get("/news", (req, res) => {
    const service = serviceFor(req);
    res.json({
      ok: true,
      ...s.content.newsPage({
        service,
        offset: intParam(req.query.offset, { min: 0, max: 100000, fallback: 0 }),
        limit: 60,
      }),
    });
  });

  r.post("/news", (req, res) => {
    res.status(201).json({
      ok: true,
      item: s.content.createNews(req.user, serviceFor(req, { required: true }), req.body.item || {}),
    });
  });
  r.put("/news/:id", (req, res) => {
    res.json({ ok: true, item: s.content.updateNews(req.user, req.params.id, req.body.item || {}) });
  });
  r.delete("/news/:id", (req, res) => {
    s.content.deleteNews(req.user, req.params.id);
    res.json({ ok: true });
  });

  /* ---------------- photos ---------------- */

  function ownPhoto(req) {
    const photo = s.photos.get(req.params.id);
    const report = photo && s.reports.get(photo.report_id);
    if (!photo || !report) throw notFound();
    if (req.user.role !== "admin" && report.service !== req.user.service) throw forbidden("notYours");
    return { photo, report };
  }

  r.get("/photos/:id", (req, res) => {
    const { photo } = ownPhoto(req);
    res.set("cache-control", "private, max-age=3600").type("image/jpeg").sendFile(s.photos.path(photo));
  });

  r.post("/photos/:id", (req, res) => {
    const { photo, report } = ownPhoto(req);
    const status = { approve: "approved", reject: "rejected" }[req.body.action];
    if (!status) throw badRequest();
    s.photos.review(photo, status, req.user);
    s.audit.log(req.user, "photo." + req.body.action, {
      targetType: "photo",
      targetId: photo.id,
      service: report.service,
      detail: { report: report.id, area: report.area },
    });
    s.live.publish("reports", { service: report.service, area: report.area, id: report.id });
    s.live.publish("photos", { service: report.service, id: photo.id }, { teamOnly: true });
    res.json({ ok: true, status });
  });

  /* ---------------- dashboard and log ---------------- */

  r.get("/stats", (req, res) => {
    res.json({
      ok: true,
      stats: s.stats.overview(serviceFor(req), intParam(req.query.days, { min: 1, max: 90, fallback: 7 })),
    });
  });

  r.get("/system", requireRole("admin"), (_req, res) => {
    res.json({ ok: true, system: s.monitor.summary({ live: s.live.size }) });
  });

  r.post("/system/errors/clear", requireRole("admin"), (req, res) => {
    const n = s.monitor.clearErrors();
    s.audit.log(req.user, "system.clearErrors", { detail: { n } });
    res.json({ ok: true, cleared: n });
  });

  r.get("/audit", requireRole("supervisor", "admin"), (req, res) => {
    const service = req.user.role === "admin" ? serviceFor(req) : req.user.service;
    res.json({
      ok: true,
      entries: s.audit.list({ service, before: intParam(req.query.before, { min: 1, fallback: null }), limit: 50 }),
    });
  });

  /* Spreadsheets for the team's own reporting. Requests hold phone numbers,
     so only supervisors and admins can export them, and it's logged. */
  r.get("/export/:what", (req, res) => {
    const service = serviceFor(req);
    const days = intParam(req.query.days, { min: 1, max: 180, fallback: 30 });
    const since = Date.now() - days * 24 * 3600e3;
    const cell = (v) => {
      const text = v == null ? "" : String(v);
      // a leading = + - @ would run as a formula in Excel
      const safe = /^[=+\-@]/.test(text) ? "'" + text : text;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const iso = (ms) => (ms ? new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : "");
    let head, rows;
    if (req.params.what === "reports") {
      head = [
        "id",
        "service",
        "neighbourhood",
        "problem",
        "people",
        "fine",
        "confirmed",
        "status",
        "started (Erbil)",
        "confirmed at",
        "fixed at",
        "team note",
      ];
      rows = s.db
        .prepare(`SELECT * FROM reports WHERE started_at >= ? ${service ? "AND service = ?" : ""} ORDER BY started_at`)
        .all(...(service ? [since, service] : [since]))
        .map((r) => [
          r.id,
          r.service,
          r.area,
          r.problem,
          r.people,
          r.fine,
          r.people >= 2 || r.team_confirmed ? "yes" : "no",
          r.status,
          iso(r.started_at),
          iso(r.confirmed_at),
          iso(r.closed_at || r.resolved_at),
          r.team_note,
        ]);
    } else if (req.params.what === "requests") {
      if (req.user.role === "staff") throw forbidden("supervisorOnly");
      head = [
        "reference",
        "service",
        "neighbourhood",
        "problem",
        "scope",
        "name",
        "phone",
        "landmark",
        "account or meter",
        "status",
        "sent (Erbil)",
        "first reply",
        "visit",
        "closed",
      ];
      rows = s.db
        .prepare(`SELECT * FROM requests WHERE created_at >= ? ${service ? "AND service = ?" : ""} ORDER BY created_at`)
        .all(...(service ? [since, service] : [since]))
        .map((q) => [
          q.ref,
          q.service,
          q.area,
          q.problem,
          q.scope,
          q.name,
          q.phone,
          q.place,
          q.meter,
          q.status,
          iso(q.created_at),
          iso(q.first_response_at),
          iso(q.visit_at),
          iso(q.closed_at),
        ]);
      s.audit.log(req.user, "export.requests", { service, detail: { days, rows: rows.length } });
    } else {
      throw notFound();
    }
    const csv = "\ufeff" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const name = `erbil-utilities-${req.params.what}-${new Date().toISOString().slice(0, 10)}.csv`;
    res
      .set({ "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` })
      .send(csv);
  });

  r.get("/live", (req, res) => {
    s.live.connect(req, res, { service: req.user.service, all: req.user.role === "admin", userId: req.user.id });
  });

  /* ---------------- live chats ---------------- */

  r.get("/chats", (req, res) => {
    const offset = intParam(req.query.offset, { min: 0, max: 100000, fallback: 0 });
    res.json({
      ok: true,
      chats: s.chats.list(req.user, { status: req.query.status, service: serviceFor(req), offset }),
      total: s.chats.count(req.user, { status: req.query.status, service: serviceFor(req) }),
    });
  });

  r.get("/chats/:id", (req, res) => res.json({ ok: true, chat: s.chats.open(req.user, req.params.id) }));

  r.post("/chats/:id", (req, res) => {
    const { action, body } = req.body;
    const chat =
      action === "say"
        ? s.chats.teamSays(req.user, req.params.id, body)
        : action === "take"
          ? s.chats.take(req.user, req.params.id)
          : action === "close"
            ? s.chats.close(req.user, req.params.id)
            : null;
    if (!chat) return res.status(400).json({ ok: false, reason: "badAction" });
    res.json({ ok: true, chat });
  });

  /* ---------------- accounts ---------------- */

  r.get("/users", requireRole("admin"), (_req, res) => res.json({ ok: true, users: s.users.list() }));

  r.post("/users", requireRole("admin"), (req, res) => {
    res.status(201).json({ ok: true, ...s.users.create(req.user, req.body) });
  });

  r.patch("/users/:id", requireRole("admin"), (req, res) => {
    res.json({ ok: true, user: s.users.update(req.user, req.params.id, req.body) });
  });

  r.get("/users/:id", requireRole("admin"), (req, res) => {
    const detail = s.users.detail(req.user, req.params.id);
    const activity = s.audit.list({ userId: detail.user.id, limit: 15 });
    res.json({ ok: true, ...detail, activity });
  });

  r.post("/users/:id/reset", requireRole("admin"), (req, res) => {
    res.json({ ok: true, ...s.users.resetPassword(req.user, req.params.id, req.body) });
  });

  r.post("/users/:id/password", requireRole("admin"), (req, res) => {
    res.json({ ok: true, user: s.users.setPassword(req.user, req.params.id, req.body) });
  });

  r.post("/users/:id/signout", requireRole("admin"), (req, res) => {
    res.json({ ok: true, ...s.users.endSession(req.user, req.params.id, req.body.session ?? null, req.body) });
  });

  r.post("/users/:id/unlock", requireRole("admin"), (req, res) => {
    res.json({ ok: true, user: s.users.unlock(req.user, req.params.id) });
  });

  r.post("/users/:id/remove", requireRole("admin"), (req, res) => {
    res.json({ ok: true, ...s.users.remove(req.user, req.params.id, req.body) });
  });

  r.post("/signout-everyone", requireRole("admin"), (req, res) => {
    res.json({ ok: true, ...s.users.signOutEveryone(req.user, req.body) });
  });

  return r;
}
